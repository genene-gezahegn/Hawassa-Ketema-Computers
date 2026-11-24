import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { canRespondToDeliveryConfirmation } from '../utils/customerDeliveryConfirmation.js';
import { sendNotificationEmail } from '../utils/email.js';
import { assertOrderPaymentVerified } from '../utils/orderPayment.js';
import { canAccessOrderMessages } from '../utils/orderMessageAccess.js';
const router=Router();
const orderSchema=z.object({idempotencyKey:z.string().uuid(),customerName:z.string().trim().min(2).max(120).regex(/\p{L}/u,'Enter a valid full name.'),phone:z.preprocess(value=>typeof value==='string'?value.trim().replace(/[\s()-]/g,''):value,z.string().regex(/^(?:0[79]\d{8}|\+251[79]\d{8})$/,'Enter a valid Ethiopian phone number.')),deliveryAddress:z.string().trim().min(5).max(500),paymentMethod:z.enum(['Cash on delivery','Bank transfer','Pay on pickup']).default('Cash on delivery'),items:z.array(z.object({productId:z.string().trim().min(1).max(80),quantity:z.number().int().min(1).max(100)})).min(1).max(30)});
const deliveryConfirmationSchema=z.discriminatedUnion('response',[
 z.object({response:z.literal('received')}).strict(),
 z.object({response:z.literal('not_received'),details:z.string().trim().min(5).max(2000)}).strict(),
]);
const orderIdSchema=z.string().uuid();
async function assertCanAccessOrderMessages(orderId,user) {
 const {rows}=await pool.query(
  'SELECT customer_id AS "customerId",delivery_person_id AS "deliveryPersonId" FROM orders WHERE id=$1',
  [orderId]);
 const order=rows[0];
 if(!order) throw new HttpError(404,'Order not found.');
 if(!canAccessOrderMessages(user,order)) throw new HttpError(404,'Order not found.');
}
router.post('/',authenticate,asyncHandler(async(req,res)=>{
 const d=orderSchema.parse(req.body);
 const client=await pool.connect();
 try { await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${req.user.id}:${d.idempotencyKey}`]);
 const {rows:existing}=await client.query('SELECT id,order_number AS "orderNumber",status,subtotal::float AS total,created_at AS "createdAt" FROM orders WHERE customer_id=$1 AND idempotency_key=$2',[req.user.id,d.idempotencyKey]);
 if(existing[0]){await client.query('COMMIT');return res.status(200).json({order:existing[0]});}
 const ids=[...new Set(d.items.map(i=>i.productId))]; const {rows:products}=await client.query('SELECT id,legacy_id AS "legacyId",sku,name,price,stock_quantity FROM products WHERE (id::text=ANY($1::text[]) OR legacy_id=ANY($1::text[])) AND is_active=true FOR UPDATE',[ids]);
 const byId=new Map();for(const product of products){byId.set(product.legacyId,product);byId.set(product.id,product);}
 const lines=[];const usedProducts=new Set();
 for(const item of d.items){const p=byId.get(item.productId);if(!p)throw new HttpError(400,'One or more products are unavailable. Refresh your cart and try again.');if(usedProducts.has(p.id))throw new HttpError(400,'Your cart contains the same product more than once. Refresh your cart and try again.');usedProducts.add(p.id);if(p.stock_quantity<item.quantity)throw new HttpError(409,`Insufficient stock for ${p.name}. Available: ${p.stock_quantity}.`);lines.push({p,quantity:item.quantity,price:Number(p.price)});}
 const total=lines.reduce((sum,line)=>sum+line.price*line.quantity,0);
 const orderNumber=`HK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
 const {rows:orders}=await client.query(`INSERT INTO orders(order_number,customer_id,customer_name,phone,delivery_address,payment_method,subtotal,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,order_number AS "orderNumber",status,subtotal::float AS total,created_at AS "createdAt"`,[orderNumber,req.user.id,d.customerName,d.phone,d.deliveryAddress,d.paymentMethod,total,d.idempotencyKey]);const order=orders[0];
 for(const line of lines){await client.query('INSERT INTO order_items(order_id,product_id,product_name,sku,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7)',[order.id,line.p.id,line.p.name,line.p.sku,line.quantity,line.price,line.price*line.quantity]);await client.query('UPDATE products SET stock_quantity=stock_quantity-$1,updated_at=NOW() WHERE id=$2',[line.quantity,line.p.id]);await client.query("INSERT INTO stock_movements(product_id,user_id,movement_type,quantity_change,note) VALUES($1,$2,'order',$3,$4)",[line.p.id,req.user.id,-line.quantity,`Order ${orderNumber}`]);}
 await client.query('COMMIT');res.status(201).json({order:{...order,items:lines.map(l=>({productId:l.p.id,name:l.p.name,sku:l.p.sku,quantity:l.quantity,unitPrice:l.price,lineTotal:l.price*l.quantity}))}});
 } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}));
router.get('/mine',authenticate,asyncHandler(async(req,res)=>{
  const {rows}=await pool.query(
    `SELECT o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
            (SELECT u.email FROM users u WHERE u.id=o.customer_id) AS email,
            o.phone, o.delivery_address AS "deliveryAddress", o.payment_method AS "paymentMethod",
            o.status, o.delivery_status AS "deliveryStatus", o.delivery_note AS "deliveryNote",
            o.failure_reason AS "failureReason", o.assigned_at AS "assignedAt",
            o.accepted_at AS "acceptedAt", o.out_for_delivery_at AS "outForDeliveryAt",
            o.delivered_at AS "deliveredAt", o.failed_at AS "failedAt",
            o.customer_confirmation_status AS "customerConfirmationStatus",
            o.customer_confirmed_at AS "customerConfirmedAt",
            o.customer_delivery_issue AS "customerDeliveryIssue",
            o.customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt",
            o.cancellation_status AS "cancellationStatus",
            o.subtotal::float AS total,
            CASE WHEN o.payment_method='Payo'
              THEN COALESCE((SELECT CASE WHEN pp.status='pending' AND pp.expires_at<=NOW() THEN 'expired' ELSE pp.status END FROM payo_payments pp WHERE pp.order_id=o.id ORDER BY pp.created_at DESC LIMIT 1),'unpaid')
              WHEN o.payment_method IN ('Bank transfer','Manual bank transfer')
              THEN COALESCE((SELECT op.status FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'pending')
              ELSE COALESCE((SELECT op.status FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'unpaid')
            END AS "paymentStatus",
            (SELECT CASE WHEN op.receipt_data IS NOT NULL THEN op.id END FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptPaymentId",
            (SELECT op.bank_code FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptBank",
            (SELECT op.transaction_reference FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "bankTransactionReference",
            (SELECT op.review_note FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptReviewNote",
            (SELECT op.created_at FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptSubmittedAt",
            o.created_at AS "createdAt", o.updated_at AS "updatedAt",
            dp.full_name AS "deliveryPersonName", dp.phone AS "deliveryPersonPhone",
            COALESCE(json_agg(json_build_object(
              'productId',i.product_id,'name',i.product_name,'sku',i.sku,
              'quantity',i.quantity,'unitPrice',i.unit_price::float,'lineTotal',i.line_total::float
            )) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
     FROM orders o
     LEFT JOIN order_items i ON i.order_id=o.id
     LEFT JOIN users dp ON dp.id=o.delivery_person_id
     WHERE o.customer_id=$1
     GROUP BY o.id, dp.full_name, dp.phone
     ORDER BY o.created_at DESC`,
    [req.user.id]);
  res.json({orders:rows});
}));

/* ── GET /orders/mine/:id — single order detail for authenticated customer ── */
router.get('/mine/:id',authenticate,asyncHandler(async(req,res)=>{
  const {rows}=await pool.query(
    `SELECT o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
            (SELECT u.email FROM users u WHERE u.id=o.customer_id) AS email,
            o.phone, o.delivery_address AS "deliveryAddress", o.payment_method AS "paymentMethod",
            o.status, o.delivery_status AS "deliveryStatus", o.delivery_note AS "deliveryNote",
            o.failure_reason AS "failureReason", o.assigned_at AS "assignedAt",
            o.accepted_at AS "acceptedAt", o.out_for_delivery_at AS "outForDeliveryAt",
            o.delivered_at AS "deliveredAt", o.failed_at AS "failedAt",
            o.customer_confirmation_status AS "customerConfirmationStatus",
            o.customer_confirmed_at AS "customerConfirmedAt",
            o.customer_delivery_issue AS "customerDeliveryIssue",
            o.customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt",
            o.cancellation_status AS "cancellationStatus",
            o.subtotal::float AS total,
            CASE WHEN o.payment_method='Payo'
              THEN COALESCE((SELECT CASE WHEN pp.status='pending' AND pp.expires_at<=NOW() THEN 'expired' ELSE pp.status END FROM payo_payments pp WHERE pp.order_id=o.id ORDER BY pp.created_at DESC LIMIT 1),'unpaid')
              WHEN o.payment_method IN ('Bank transfer','Manual bank transfer')
              THEN COALESCE((SELECT op.status FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'pending')
              ELSE COALESCE((SELECT op.status FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'unpaid')
            END AS "paymentStatus",
            (SELECT CASE WHEN op.receipt_data IS NOT NULL THEN op.id END FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptPaymentId",
            (SELECT op.bank_code FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptBank",
            (SELECT op.transaction_reference FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "bankTransactionReference",
            (SELECT op.review_note FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptReviewNote",
            (SELECT op.created_at FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1) AS "receiptSubmittedAt",
            o.created_at AS "createdAt", o.updated_at AS "updatedAt",
            dp.full_name AS "deliveryPersonName", dp.phone AS "deliveryPersonPhone",
            COALESCE(json_agg(json_build_object(
              'productId',i.product_id,'name',i.product_name,'sku',i.sku,
              'quantity',i.quantity,'unitPrice',i.unit_price::float,'lineTotal',i.line_total::float
            )) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
     FROM orders o
     LEFT JOIN order_items i ON i.order_id=o.id
     LEFT JOIN users dp ON dp.id=o.delivery_person_id
     WHERE o.id=$1 AND o.customer_id=$2
     GROUP BY o.id, dp.full_name, dp.phone`,
    [req.params.id, req.user.id]);
  if(!rows[0]) throw new HttpError(404,'Order not found.');
  res.json({order:rows[0]});
}));

router.get('/:id/messages',authenticate,asyncHandler(async(req,res)=>{
 const orderId=orderIdSchema.parse(req.params.id);
 await assertCanAccessOrderMessages(orderId,req.user);
 const {rows}=await pool.query(
  `SELECT m.id,m.message,m.sender_role AS "senderRole",
          COALESCE(u.full_name,'Store team') AS "senderName",m.created_at AS "createdAt"
   FROM order_messages m
   LEFT JOIN users u ON u.id=m.sender_id
   WHERE m.order_id=$1
   ORDER BY m.created_at ASC
   LIMIT 100`,
  [orderId]);
 res.json({messages:rows});
}));

router.post('/:id/messages',authenticate,asyncHandler(async(req,res)=>{
 const orderId=orderIdSchema.parse(req.params.id);
 const {message}=z.object({message:z.string().trim().min(1).max(2000)}).strict().parse(req.body);
 await assertCanAccessOrderMessages(orderId,req.user);
 const {rows}=await pool.query(
  `INSERT INTO order_messages(order_id,sender_id,sender_role,message)
   VALUES($1,$2,$3,$4)
   RETURNING id,message,sender_role AS "senderRole",created_at AS "createdAt"`,
  [orderId,req.user.id,req.user.role,message]);
 res.status(201).json({message:{...rows[0],senderName:req.user.full_name}});
}));

router.post('/mine/:id/delivery-confirmation',authenticate,requireRole('customer'),asyncHandler(async(req,res)=>{
 const orderId=orderIdSchema.parse(req.params.id);
 const response=deliveryConfirmationSchema.parse(req.body);
 const client=await pool.connect();
 let confirmation;
 try{
  await client.query('BEGIN');
  const {rows:found}=await client.query(
   `SELECT id,order_number AS "orderNumber",
           delivery_status AS "deliveryStatus",
           customer_confirmation_status AS "customerConfirmationStatus"
    FROM orders
    WHERE id=$1 AND customer_id=$2
    FOR UPDATE`,
   [orderId,req.user.id]);
  if(!found[0]) throw new HttpError(404,'Order not found.');
  if(!canRespondToDeliveryConfirmation(found[0].deliveryStatus,found[0].customerConfirmationStatus))
   throw new HttpError(409,'This order is not awaiting a delivery confirmation response.');

  const result=response.response==='received'
   ? await client.query(
      `UPDATE orders
       SET customer_confirmation_status='customer_confirmed',
           customer_confirmed_at=NOW(),
           customer_confirmation_user_id=$1,
           customer_delivery_issue='',
           customer_delivery_issue_reported_at=NULL,
           updated_at=NOW()
       WHERE id=$2 AND customer_id=$1
         AND customer_confirmation_status='awaiting_confirmation'
       RETURNING id,order_number AS "orderNumber",delivery_status AS "deliveryStatus",
                 customer_confirmation_status AS "customerConfirmationStatus",
                 customer_confirmed_at AS "customerConfirmedAt",
                 customer_delivery_issue AS "customerDeliveryIssue",
                 customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt"`,
      [req.user.id,orderId])
   : await client.query(
      `UPDATE orders
       SET customer_confirmation_status='issue_reported',
           customer_confirmed_at=NULL,
           customer_confirmation_user_id=$1,
           customer_delivery_issue=$2,
           customer_delivery_issue_reported_at=NOW(),
           updated_at=NOW()
       WHERE id=$3 AND customer_id=$1
         AND customer_confirmation_status='awaiting_confirmation'
       RETURNING id,order_number AS "orderNumber",delivery_status AS "deliveryStatus",
                 customer_confirmation_status AS "customerConfirmationStatus",
                 customer_confirmed_at AS "customerConfirmedAt",
                 customer_delivery_issue AS "customerDeliveryIssue",
                 customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt"`,
      [req.user.id,response.details,orderId]);
  confirmation=result.rows[0];
  if(!confirmation) throw new HttpError(409,'This order has already received a confirmation response.');
  await client.query('COMMIT');
 }catch(error){
  await client.query('ROLLBACK');
  throw error;
 }finally{
  client.release();
 }

 const message=response.response==='received'
  ? 'Receipt confirmed. Thank you for shopping with Hawassa-Ketema Computers.'
  : 'Your delivery concern has been submitted. Our team will review your report.';
 let emailNotificationStatus;
 try{
  const {rows:recipients}=await pool.query(
   `SELECT DISTINCT u.email
    FROM users u
    WHERE u.is_active=true
      AND u.email IS NOT NULL
      AND (
        u.role='admin'
        OR u.id=(SELECT o.delivery_person_id FROM orders o WHERE o.id=$1)
        OR u.id=(
          SELECT e.actor_id
          FROM order_delivery_events e
          WHERE e.order_id=$1
            AND (e.action_type IN ('ASSIGNED','REASSIGNED')
                 OR (e.action_type='STATUS_CHANGED' AND e.to_status='assigned'))
          ORDER BY e.created_at DESC
          LIMIT 1
        )
      )`,
   [orderId]);
  const recipientEmails=recipients.map(recipient=>recipient.email);
  if(recipientEmails.length===0){
   emailNotificationStatus='no_recipients';
   console.warn('[Email notification] No active administrator or assigned-staff email addresses; delivery confirmation remains visible in the order.');
  }else{
   const responseLabel=response.response==='received'
    ? 'confirmed receipt'
    : 'reported not receiving';
   const details=response.response==='not_received'
    ? `\n\nReported details:\n${response.details}`
    : '';
   emailNotificationStatus=await sendNotificationEmail({
    to:recipientEmails,
    subject:`Delivery confirmation: ${confirmation.orderNumber}`,
    text:`${req.user.full_name} ${responseLabel} order ${confirmation.orderNumber}.${details}\n\nReview the delivery confirmation in the Admin Orders or assigned staff dashboard.`,
   });
  }
 }catch(error){
  emailNotificationStatus='failed';
  console.error('[Email notification] Could not notify administrators or assigned staff:',error.message);
 }
 res.json({confirmation,message,emailNotificationStatus});
}));

/* ── POST /orders/mine/:id/cancel — customer cancellation request ── */
router.post('/mine/:id/cancel',authenticate,asyncHandler(async(req,res)=>{
  const {reason}=z.object({reason:z.string().trim().min(2).max(500)}).parse(req.body);
  const {rows:found}=await pool.query(
    'SELECT id,status,customer_id,payment_method FROM orders WHERE id=$1 AND customer_id=$2',
    [req.params.id,req.user.id]);
  if(!found[0]) throw new HttpError(404,'Order not found.');
  const cancellable=['pending','confirmed'];
  if(!cancellable.includes(found[0].status))
    throw new HttpError(409,`Orders in status '${found[0].status}' cannot have cancellation requested.`);
  // Check no pending cancellation already exists
  const {rows:existing}=await pool.query(
    "SELECT id FROM order_cancellations WHERE order_id=$1 AND status='requested'",
    [req.params.id]);
  if(existing[0]) throw new HttpError(409,'A cancellation request is already pending for this order.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO order_cancellations(order_id,customer_id,reason) VALUES($1,$2,$3)',
      [req.params.id,req.user.id,reason]);
    await client.query(
      "UPDATE orders SET cancellation_status='requested',updated_at=NOW() WHERE id=$1",
      [req.params.id]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  res.json({message:'Cancellation request submitted. The store will review it shortly.'});
}));

/* ── POST /orders/mine/:id/return — customer return request ── */
router.post('/mine/:id/return',authenticate,asyncHandler(async(req,res)=>{
  const schema=z.object({
    items:z.array(z.object({productId:z.string().uuid(),name:z.string().trim().min(1).max(180),quantity:z.number().int().min(1),reason:z.string().trim().min(1).max(200)})).min(1),
    reason:z.enum(['defective','wrong_item','changed_mind','damaged_in_transit','other']),
    description:z.string().trim().max(1000).default(''),
  });
  const data=schema.parse(req.body);
  const {rows:found}=await pool.query(
    "SELECT id,status FROM orders WHERE id=$1 AND customer_id=$2",
    [req.params.id,req.user.id]);
  if(!found[0]) throw new HttpError(404,'Order not found.');
  if(found[0].status!=='completed')
    throw new HttpError(409,'Only completed (delivered) orders can have return requests.');
  const {rows:existing}=await pool.query(
    "SELECT id FROM order_returns WHERE order_id=$1 AND status NOT IN ('rejected')",
    [req.params.id]);
  if(existing[0]) throw new HttpError(409,'A return request already exists for this order.');
  await pool.query(
    'INSERT INTO order_returns(order_id,customer_id,items,reason,description) VALUES($1,$2,$3,$4,$5)',
    [req.params.id,req.user.id,JSON.stringify(data.items),data.reason,data.description]);
  res.json({message:'Return request submitted. The store will review it and respond shortly.'});
}));

/* ── PATCH /orders/mine/:id/address — update delivery address before dispatch ── */
router.patch('/mine/:id/address',authenticate,asyncHandler(async(req,res)=>{
  const orderId=orderIdSchema.parse(req.params.id);
  const schema=z.object({
    deliveryAddress:z.string().trim().min(5).max(500).optional(),
    phone:z.preprocess(
      value=>typeof value==='string'?value.trim().replace(/[\s()-]/g,''):value,
      z.string().regex(/^(?:0[79]\d{8}|\+251[79]\d{8})$/,'Enter a valid Ethiopian phone number.')
    ).optional(),
  });
  const data=schema.parse(req.body);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows:found}=await client.query(
      'SELECT id,status FROM orders WHERE id=$1 AND customer_id=$2 FOR UPDATE',
      [orderId,req.user.id]);
    if(!found[0]) throw new HttpError(404,'Order not found.');
    if(!['pending','confirmed'].includes(found[0].status))
      throw new HttpError(409,'Delivery details can only be changed before the order is prepared.');
    const setClauses=[];const values=[];let idx=1;
    if(data.deliveryAddress){setClauses.push(`delivery_address=$${idx++}`);values.push(data.deliveryAddress);}
    if(data.phone){setClauses.push(`phone=$${idx++}`);values.push(data.phone);}
    if(setClauses.length===0){
      await client.query('COMMIT');
      return res.json({message:'Nothing to update.'});
    }
    setClauses.push('updated_at=NOW()');values.push(orderId);
    const {rows}=await client.query(
      `UPDATE orders SET ${setClauses.join(',')} WHERE id=$${idx}
       RETURNING id,order_number AS "orderNumber",phone,delivery_address AS "deliveryAddress"`,
      values);
    await client.query('COMMIT');
    res.json({order:rows[0]});
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
  }
}));

/* ── GET /orders/mine/:id/return — get return request for an order ── */
router.get('/mine/:id/return',authenticate,asyncHandler(async(req,res)=>{
  const {rows:order}=await pool.query(
    'SELECT id FROM orders WHERE id=$1 AND customer_id=$2',
    [req.params.id,req.user.id]);
  if(!order[0]) throw new HttpError(404,'Order not found.');
  const {rows}=await pool.query(
    `SELECT id,status,reason,description,items,admin_note AS "adminNote",created_at AS "createdAt",updated_at AS "updatedAt"
     FROM order_returns WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [req.params.id]);
  res.json({returnRequest:rows[0]||null});
}));
router.get('/',authenticate,requireRole('admin'),asyncHandler(async(_req,res)=>{
 const {rows}=await pool.query(`SELECT
  o.id,o.order_number AS "orderNumber",o.customer_id AS "customerId",
  o.customer_name AS "customerName",u.email,o.phone,
  o.delivery_address AS "deliveryAddress",o.payment_method AS "paymentMethod",o.status,
  o.delivery_status AS "deliveryStatus",o.delivery_note AS "deliveryNote",
  o.failure_reason AS "failureReason",o.delivery_person_id AS "deliveryPersonId",
  dp.full_name AS "deliveryPersonName",dp.phone AS "deliveryPersonPhone",
  o.assigned_at AS "assignedAt",o.accepted_at AS "acceptedAt",
  o.out_for_delivery_at AS "outForDeliveryAt",o.delivered_at AS "deliveredAt",o.failed_at AS "failedAt",
  o.customer_confirmation_status AS "customerConfirmationStatus",
  o.customer_confirmed_at AS "customerConfirmedAt",
  o.customer_delivery_issue AS "customerDeliveryIssue",
  o.customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt",
  o.subtotal::float AS total,
  CASE WHEN o.payment_method='Payo'
    THEN COALESCE((SELECT CASE WHEN pp.status='pending' AND pp.expires_at<=NOW() THEN 'expired' ELSE pp.status END FROM payo_payments pp WHERE pp.order_id=o.id ORDER BY pp.created_at DESC LIMIT 1),'unpaid')
    WHEN o.payment_method IN ('Bank transfer','Manual bank transfer')
    THEN COALESCE((SELECT op.status FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'pending')
    ELSE COALESCE((SELECT op.status FROM order_payments op WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'unpaid')
  END AS "paymentStatus",
  o.created_at AS "createdAt",
  COALESCE(json_agg(json_build_object('productId',i.product_id,'name',i.product_name,'sku',i.sku,'quantity',i.quantity,'unitPrice',i.unit_price,'lineTotal',i.line_total)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
  FROM orders o JOIN users u ON u.id=o.customer_id
  LEFT JOIN users dp ON dp.id=o.delivery_person_id
  LEFT JOIN order_items i ON i.order_id=o.id
  GROUP BY o.id,u.email,dp.full_name,dp.phone ORDER BY o.created_at DESC`);
 res.json({orders:rows});
}));
router.patch('/:id/status',authenticate,requireRole('admin'),asyncHandler(async(req,res)=>{
 const schema=z.object({status:z.enum(['confirmed','processing','ready','completed','cancelled'])});const {status}=schema.parse(req.body);const client=await pool.connect();
 try{await client.query('BEGIN');const {rows:found}=await client.query('SELECT id,status,payment_method,delivery_person_id,delivery_status FROM orders WHERE id=$1 FOR UPDATE',[req.params.id]);if(!found[0])throw new HttpError(404,'Order not found.');
  if(status==='completed'&&found[0].delivery_person_id&&found[0].delivery_status!=='delivered')throw new HttpError(409,'Complete the assigned delivery before completing this order.');
  if(status==='cancelled'&&found[0].delivery_person_id&&!['failed','returned'].includes(found[0].delivery_status))throw new HttpError(409,'Remove or resolve the active delivery assignment before cancelling this order.');
  if(status!=='cancelled')await assertOrderPaymentVerified(client,found[0],'This payment must be verified before confirming or fulfilling the order.');
  if(status==='cancelled'&&found[0].status!=='cancelled'){
   if(found[0].status==='completed')throw new HttpError(409,'A completed order cannot be cancelled.');
   const {rows:items}=await client.query('SELECT product_id,quantity,product_name FROM order_items WHERE order_id=$1',[req.params.id]);
   for(const item of items){await client.query('UPDATE products SET stock_quantity=stock_quantity+$1,updated_at=NOW() WHERE id=$2',[item.quantity,item.product_id]);await client.query("INSERT INTO stock_movements(product_id,user_id,movement_type,quantity_change,note) VALUES($1,$2,'adjustment',$3,$4)",[item.product_id,req.user.id,item.quantity,`Restocked after order cancellation ${req.params.id}`]);}
  }
  const {rows}=await client.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,order_number AS "orderNumber",status,updated_at AS "updatedAt"',[status,req.params.id]);await client.query('COMMIT');res.json({order:rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
export default router;
