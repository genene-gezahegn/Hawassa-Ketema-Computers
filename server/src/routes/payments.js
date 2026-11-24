import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { decodePaymentReceipt } from '../utils/paymentReceipt.js';

const router = Router();
const bankSchema = z.enum(['cbe','telebirr','boa','dashen','awash','mpesa','cbebirr','other']);
const orderIdSchema = z.string().uuid();

router.get('/admin/legacy-payo', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const status = req.query.status === undefined
    ? null
    : z.enum(['pending', 'paid', 'failed', 'rejected', 'expired']).parse(req.query.status);
  const { rows } = await pool.query(
    `SELECT p.id, p.order_id AS "orderId", o.order_number AS "orderNumber",
            p.payo_order_id AS "payoOrderId", p.payment_reference AS "paymentReference",
            p.amount::float AS amount, p.currency,
            CASE WHEN p.status='pending' AND p.expires_at<=NOW() THEN 'expired' ELSE p.status END AS status,
            p.transaction_reference AS "transactionReference", p.sender_name AS "senderName",
            p.initialization_error AS "initializationError",
            p.created_at AS "createdAt", p.expires_at AS "expiresAt", p.paid_at AS "paidAt",
            o.customer_name AS "customerName", u.email
     FROM payo_payments p
     JOIN orders o ON o.id=p.order_id
     JOIN users u ON u.id=p.customer_id
     WHERE ($1::varchar IS NULL OR
       (CASE WHEN p.status='pending' AND p.expires_at<=NOW() THEN 'expired' ELSE p.status END)=$1)
     ORDER BY p.created_at DESC
     LIMIT 200`,
    [status],
  );
  res.json({ payments: rows });
}));
router.get('/instructions', (_req, res) => {
  res.json({ bankName: process.env.PAYMENT_BANK_NAME || 'Bank transfer', accountName: process.env.PAYMENT_ACCOUNT_NAME || 'Configure store account', accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || '', instructions: process.env.PAYMENT_INSTRUCTIONS || 'Transfer the exact order amount and submit your transaction reference.' });
});

// A manual bank receipt is evidence for staff review, never proof of settlement by itself.
router.post('/orders/:orderId/receipt', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const parsed = z.object({
    bank: bankSchema,
    reference: z.string().trim().min(5).max(180),
    senderName: z.string().trim().max(120).optional().default(''),
    receiptMime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional(),
    receiptData: z.string().max(7_000_000).optional(),
  }).strict().parse(req.body);
  const receiptBuffer = decodePaymentReceipt(parsed.receiptMime, parsed.receiptData);

  const orderId = orderIdSchema.parse(req.params.orderId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: orders } = await client.query(
      `SELECT id, customer_id AS "customerId", payment_method AS "paymentMethod", status
       FROM orders WHERE id=$1 AND customer_id=$2 FOR UPDATE`,
      [orderId, req.user.id],
    );
    const order = orders[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === 'cancelled') throw new HttpError(409, 'A cancelled order cannot receive payment.');
    if (!['Bank transfer', 'Manual bank transfer'].includes(order.paymentMethod)) {
      throw new HttpError(400, 'This order is not configured for bank transfer.');
    }

    const { rows: verified } = await client.query(
      "SELECT id FROM order_payments WHERE order_id=$1 AND status='verified' LIMIT 1",
      [order.id],
    );
    if (verified[0]) throw new HttpError(409, 'This order already has a verified payment.');

    const { rows: reviewQueue } = await client.query(
      "SELECT id, (receipt_data IS NOT NULL) AS \"hasReceipt\" FROM order_payments WHERE order_id=$1 AND status='pending_review' LIMIT 1",
      [order.id],
    );
    if (reviewQueue[0]) {
      if (reviewQueue[0].hasReceipt || !receiptBuffer) {
        throw new HttpError(409, 'Your receipt is awaiting review. You can replace it after staff review.');
      }
      const { rows: updated } = await client.query(
        `UPDATE order_payments
         SET sender_name=$1, receipt_mime=$2, receipt_data=$3, updated_at=NOW()
         WHERE id=$4
         RETURNING id,status,created_at AS "createdAt"`,
        [parsed.senderName, parsed.receiptMime || null, receiptBuffer, reviewQueue[0].id],
      );
      await client.query('COMMIT');
      return res.status(201).json({
        payment: updated[0],
        message: 'Receipt added. Payment is awaiting staff verification.',
      });
    }

    const { rows: duplicateRows } = await client.query(
      'SELECT id, order_id AS "orderId", status FROM order_payments WHERE bank_code=$1 AND transaction_reference=$2 FOR UPDATE',
      [parsed.bank, parsed.reference],
    );
    const duplicate = duplicateRows[0];
    let payment;
    if (duplicate) {
      if (duplicate.orderId !== order.id || duplicate.status !== 'rejected') {
        throw new HttpError(409, 'This transaction reference has already been submitted.');
      }
      const { rows: updated } = await client.query(
        `UPDATE order_payments
         SET sender_name=$1, receipt_mime=$2, receipt_data=$3, status='pending_review',
             review_note=CASE WHEN review_note='' THEN 'Receipt resubmitted for review.'
               ELSE review_note || E'\\nReceipt resubmitted for review.' END,
             reviewer_id=NULL, verified_at=NULL, verification_provider=NULL,
             verification_payload=NULL, updated_at=NOW()
         WHERE id=$4
         RETURNING id,status,created_at AS "createdAt"`,
        [parsed.senderName, parsed.receiptMime || null, receiptBuffer, duplicate.id],
      );
      payment = updated[0];
    } else {
      const { rows: inserted } = await client.query(
        `INSERT INTO order_payments(order_id,customer_id,bank_code,transaction_reference,sender_name,receipt_mime,receipt_data,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,'pending_review')
         RETURNING id,status,created_at AS "createdAt"`,
        [order.id, req.user.id, parsed.bank, parsed.reference, parsed.senderName, parsed.receiptMime || null, receiptBuffer],
      );
      payment = inserted[0];
    }

    await client.query('COMMIT');
    res.status(201).json({
      payment,
      message: 'Receipt submitted. Payment is awaiting staff verification.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.get('/orders/:orderId/receipt', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const orderId = orderIdSchema.parse(req.params.orderId);
  const { rows } = await pool.query(
    `SELECT p.receipt_mime AS "receiptMime", p.receipt_data AS "receiptData"
     FROM order_payments p
     JOIN orders o ON o.id=p.order_id
     WHERE o.id=$1 AND o.customer_id=$2
       AND p.id=(SELECT latest.id FROM order_payments latest
                 WHERE latest.order_id=o.id ORDER BY latest.created_at DESC LIMIT 1)`,
    [orderId, req.user.id],
  );
  const receipt = rows[0];
  if (!receipt) throw new HttpError(404, 'No receipt file was uploaded for this order.');
  const extension = receipt.receiptMime === 'application/pdf' ? 'pdf' : 'jpg';
  res.setHeader('Content-Type', receipt.receiptMime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="order-receipt.${extension}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(receipt.receiptData);
}));

router.get('/admin/pending', authenticate, requireRole('admin'), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id,p.order_id AS "orderId",o.order_number AS "orderNumber",
            p.bank_code AS bank,p.transaction_reference AS reference,
            p.sender_name AS "senderName",p.status,p.created_at AS "createdAt",
            o.subtotal::float AS amount,u.full_name AS "customerName",u.email,
            p.review_note AS "reviewNote",(p.receipt_data IS NOT NULL) AS "hasReceipt",
            (SELECT COALESCE(json_agg(json_build_object('name',i.product_name,'quantity',i.quantity)), '[]'::json)
             FROM order_items i WHERE i.order_id=o.id) AS items
     FROM order_payments p
     JOIN orders o ON o.id=p.order_id
     JOIN users u ON u.id=p.customer_id
     WHERE p.status='pending_review'
     ORDER BY p.created_at DESC`,
  );
  res.json({ payments: rows });
}));

router.get('/admin/review-history', authenticate, requireRole('admin'), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT h.id, h.payment_id AS "paymentId", h.action, h.note,
            h.reviewed_at AS "reviewedAt", reviewer.full_name AS "reviewerName",
            payments.order_id AS "orderId", orders.order_number AS "orderNumber",
            payments.transaction_reference AS reference,
            orders.subtotal::float AS amount
     FROM order_payment_reviews h
     JOIN order_payments payments ON payments.id=h.payment_id
     JOIN orders ON orders.id=payments.order_id
     LEFT JOIN users reviewer ON reviewer.id=h.reviewer_id
     ORDER BY h.reviewed_at DESC
     LIMIT 200`,
  );
  res.json({ history: rows });
}));

router.get('/admin/:paymentId/receipt', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT receipt_mime,receipt_data FROM order_payments WHERE id=$1', [req.params.paymentId]);
  if (!rows[0]?.receipt_data) throw new HttpError(404, 'No receipt image was uploaded.');
  res.setHeader('Content-Type', rows[0].receipt_mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', 'inline; filename="payment-receipt"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(rows[0].receipt_data);
}));

router.patch('/admin/:paymentId/review', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { action, note } = z.object({ action: z.enum(['approve','reject']), note: z.string().trim().max(500).optional().default('') }).parse(req.body);
  if (action === 'reject' && note.length < 5) {
    throw new HttpError(400, 'Provide a rejection reason of at least 5 characters.');
  }
  const status = action === 'approve' ? 'verified' : 'rejected';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: payments } = await client.query(
      `SELECT p.id, p.order_id AS "orderId", p.status
       FROM order_payments p
       JOIN orders o ON o.id=p.order_id
       WHERE p.id=$1
       FOR UPDATE OF p, o`,
      [req.params.paymentId],
    );
    const payment = payments[0];
    if (!payment) throw new HttpError(404, 'Payment not found.');
    if (payment.status !== 'pending_review') {
      throw new HttpError(409, 'Only receipts awaiting review can be approved or rejected.');
    }
    if (action === 'approve') {
      const { rows: existing } = await client.query(
        "SELECT id FROM order_payments WHERE order_id=$1 AND status='verified' AND id<>$2 LIMIT 1",
        [payment.orderId, payment.id],
      );
      if (existing[0]) throw new HttpError(409, 'Another payment for this order has already been verified.');
    }
    const { rows } = await client.query(
      `UPDATE order_payments
       SET status=$1::varchar(24),
           reviewer_id=$2,
           review_note=$3,
           verified_at=CASE WHEN $1::varchar(24)='verified' THEN NOW() ELSE NULL END,
           updated_at=NOW()
       WHERE id=$4
       RETURNING id,status,review_note AS "reviewNote"`,
      [status, req.user.id, note, payment.id],
    );
    await client.query(
      `INSERT INTO order_payment_reviews(payment_id, reviewer_id, action, note)
       VALUES($1, $2, $3, $4)`,
      [payment.id, req.user.id, action === 'approve' ? 'approved' : 'rejected', note],
    );
    await client.query('COMMIT');
    res.json({ payment: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
