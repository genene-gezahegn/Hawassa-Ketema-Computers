/**
 * Delivery routes — /api/delivery.
 * Delivery people can access only their own assignments; administrators manage assignments.
 */
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { assertOrderPaymentVerified } from '../utils/orderPayment.js';
import { canTransitionDeliveryStatus } from '../utils/deliveryWorkflow.js';
import { hasDeliveryPermission } from '../utils/deliveryPermissions.js';
import { sendNotificationEmail } from '../utils/email.js';

const router = Router();

const deliveryStatusSchema = z.object({
  deliveryStatus: z.enum(['accepted', 'out_for_delivery', 'delivered', 'failed', 'returned']),
  deliveryNote: z.string().trim().max(500).optional(),
  failureReason: z.string().trim().max(500).optional(),
}).strict();

const assignSchema = z.object({ deliveryPersonId: z.string().uuid() });
const orderIdSchema = z.string().uuid();

router.get('/mine', authenticate, requireRole('delivery_person'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
       o.phone, o.delivery_address AS "deliveryAddress", o.status,
       o.delivery_status AS "deliveryStatus", o.delivery_note AS "deliveryNote",
       o.failure_reason AS "failureReason", o.assigned_at AS "assignedAt",
       o.accepted_at AS "acceptedAt", o.out_for_delivery_at AS "outForDeliveryAt",
       o.delivered_at AS "deliveredAt", o.failed_at AS "failedAt",
       o.customer_confirmation_status AS "customerConfirmationStatus",
       o.customer_confirmed_at AS "customerConfirmedAt",
       o.customer_delivery_issue AS "customerDeliveryIssue",
       o.customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt",
       o.subtotal::float AS total, o.payment_method AS "paymentMethod",
       CASE WHEN o.payment_method='Payo'
         THEN COALESCE((SELECT CASE WHEN pp.status='pending' AND pp.expires_at<=NOW() THEN 'expired' ELSE pp.status END FROM payo_payments pp
                        WHERE pp.order_id=o.id ORDER BY pp.created_at DESC LIMIT 1),'unpaid')
         WHEN o.payment_method IN ('Bank transfer','Manual bank transfer')
           THEN COALESCE((SELECT op.status FROM order_payments op
                          WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'pending')
         ELSE COALESCE((SELECT op.status FROM order_payments op
                        WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'unpaid')
       END AS "paymentStatus",
       o.created_at AS "createdAt",
       COALESCE(json_agg(json_build_object(
         'name', i.product_name, 'sku', i.sku, 'quantity', i.quantity,
         'unitPrice', i.unit_price::float
       )) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM orders o
     LEFT JOIN order_items i ON i.order_id=o.id
     WHERE o.delivery_person_id=$1
     GROUP BY o.id
     ORDER BY o.assigned_at DESC NULLS LAST, o.created_at DESC`,
    [req.user.id],
  );
  res.json({ deliveries: rows });
}));

router.patch('/:orderId/status', authenticate, requireRole('delivery_person'), asyncHandler(async (req, res) => {
  const orderId = orderIdSchema.parse(req.params.orderId);
  const { deliveryStatus, deliveryNote, failureReason } = deliveryStatusSchema.parse(req.body);
  if (deliveryStatus === 'failed' && !failureReason) {
    throw new HttpError(400, 'Enter a reason for the failed delivery.');
  }

  const client = await pool.connect();
  let delivery;
  let customerEmail;
  let orderNumber;
  try {
    await client.query('BEGIN');
    const { rows: foundRows } = await client.query(
      `SELECT o.id, o.order_number AS "orderNumber", o.status,
              o.delivery_status AS "deliveryStatus", o.delivery_note AS "deliveryNote",
              o.failure_reason AS "failureReason", u.email AS "customerEmail"
       FROM orders o
       JOIN users u ON u.id=o.customer_id
       WHERE o.id=$1 AND o.delivery_person_id=$2
       FOR UPDATE OF o`,
      [orderId, req.user.id],
    );
    const found = foundRows[0];
    if (!found) throw new HttpError(404, 'Delivery not found or not assigned to you.');
    if (found.status === 'cancelled') throw new HttpError(409, 'A cancelled order cannot be updated for delivery.');
    if (!canTransitionDeliveryStatus(found.deliveryStatus, deliveryStatus)) {
      throw new HttpError(409, `Cannot move delivery from '${found.deliveryStatus}' to '${deliveryStatus}'.`);
    }
    customerEmail = found.customerEmail;
    orderNumber = found.orderNumber;

    const nextFailureReason = deliveryStatus === 'failed'
      ? failureReason
      : deliveryStatus === 'out_for_delivery' ? '' : found.failureReason;
    const note = deliveryStatus === 'failed' ? failureReason : deliveryNote ?? found.deliveryNote;
    const { rows } = await client.query(
      `UPDATE orders
       SET delivery_status=$1::varchar(24),
           delivery_note=$2,
           failure_reason=$3,
           accepted_at=CASE WHEN $1::varchar(24)='accepted' THEN COALESCE(accepted_at,NOW()) ELSE accepted_at END,
           out_for_delivery_at=CASE WHEN $1::varchar(24)='out_for_delivery' THEN NOW() ELSE out_for_delivery_at END,
           delivered_at=CASE WHEN $1::varchar(24)='delivered' THEN NOW() ELSE delivered_at END,
           failed_at=CASE WHEN $1::varchar(24)='failed' THEN NOW() ELSE failed_at END,
           status=CASE WHEN $1::varchar(24)='delivered' THEN 'completed' ELSE status END,
           customer_confirmation_status=CASE WHEN $1::varchar(24)='delivered' THEN 'awaiting_confirmation' ELSE customer_confirmation_status END,
           customer_confirmed_at=CASE WHEN $1::varchar(24)='delivered' THEN NULL ELSE customer_confirmed_at END,
           customer_confirmation_user_id=CASE WHEN $1::varchar(24)='delivered' THEN NULL ELSE customer_confirmation_user_id END,
           customer_delivery_issue=CASE WHEN $1::varchar(24)='delivered' THEN '' ELSE customer_delivery_issue END,
           customer_delivery_issue_reported_at=CASE WHEN $1::varchar(24)='delivered' THEN NULL ELSE customer_delivery_issue_reported_at END,
           updated_at=NOW()
       WHERE id=$4 AND delivery_person_id=$5
       RETURNING id, order_number AS "orderNumber", status,
                 delivery_status AS "deliveryStatus", delivery_note AS "deliveryNote",
                 failure_reason AS "failureReason", assigned_at AS "assignedAt",
                 accepted_at AS "acceptedAt", out_for_delivery_at AS "outForDeliveryAt",
                 delivered_at AS "deliveredAt", failed_at AS "failedAt",
                 customer_confirmation_status AS "customerConfirmationStatus",
                 customer_confirmed_at AS "customerConfirmedAt",
                 customer_delivery_issue AS "customerDeliveryIssue",
                 customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt"`,
      [deliveryStatus, note, nextFailureReason, orderId, req.user.id],
    );
    await client.query(
      `INSERT INTO order_delivery_events(order_id, actor_id, delivery_person_id, from_status, to_status, note)
       VALUES($1, $2, $2, $3, $4, $5)`,
      [orderId, req.user.id, found.deliveryStatus, deliveryStatus, note || ''],
    );
    await client.query('COMMIT');
    delivery = rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  let emailNotificationStatus;
  if (deliveryStatus === 'delivered') {
    try {
      emailNotificationStatus = await sendNotificationEmail({
        to: customerEmail,
        subject: `Order ${orderNumber} marked delivered`,
        text: `Your order ${orderNumber} has been marked as delivered. Sign in to your Hawassa-Ketema Computers account and open My Orders to confirm receipt or report a delivery concern.`,
      });
    } catch (error) {
      emailNotificationStatus = 'failed';
      console.error('[Email notification] Could not send customer delivery confirmation request:', error.message);
    }
  }
  res.json({ delivery, emailNotificationStatus });
}));

router.get('/', authenticate, requireAnyPermission('ASSIGN_DELIVERIES', 'VIEW_ALL_DELIVERIES'), asyncHandler(async (req, res) => {
  const canViewAll = req.user.role === 'admin'
    || req.user.permissions.includes('VIEW_ALL_DELIVERIES');
  const scope = canViewAll
    ? ''
    : `WHERE o.status='ready'
       AND o.delivery_status IN ('unassigned', 'assigned', 'failed', 'returned')`;
  const { rows } = await pool.query(
    `SELECT
       o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
       o.phone, o.delivery_address AS "deliveryAddress", o.status,
       o.delivery_status AS "deliveryStatus", o.delivery_note AS "deliveryNote",
       o.failure_reason AS "failureReason", o.assigned_at AS "assignedAt",
       o.accepted_at AS "acceptedAt", o.out_for_delivery_at AS "outForDeliveryAt",
       o.delivered_at AS "deliveredAt", o.failed_at AS "failedAt",
       o.customer_confirmation_status AS "customerConfirmationStatus",
       o.customer_confirmed_at AS "customerConfirmedAt",
       o.customer_delivery_issue AS "customerDeliveryIssue",
       o.customer_delivery_issue_reported_at AS "customerDeliveryIssueReportedAt",
       o.subtotal::float AS total, o.payment_method AS "paymentMethod",
       CASE WHEN o.payment_method='Payo'
         THEN COALESCE((SELECT CASE WHEN pp.status='pending' AND pp.expires_at<=NOW() THEN 'expired' ELSE pp.status END FROM payo_payments pp
                        WHERE pp.order_id=o.id ORDER BY pp.created_at DESC LIMIT 1),'unpaid')
         WHEN o.payment_method IN ('Bank transfer','Manual bank transfer')
           THEN COALESCE((SELECT op.status FROM order_payments op
                          WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'pending')
         ELSE COALESCE((SELECT op.status FROM order_payments op
                        WHERE op.order_id=o.id ORDER BY op.created_at DESC LIMIT 1),'unpaid')
       END AS "paymentStatus",
       o.created_at AS "createdAt", dp.full_name AS "deliveryPersonName",
       dp.phone AS "deliveryPersonPhone", o.delivery_person_id AS "deliveryPersonId",
       COALESCE(json_agg(json_build_object(
         'name', i.product_name, 'sku', i.sku, 'quantity', i.quantity,
         'unitPrice', i.unit_price::float
       )) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM orders o
     LEFT JOIN users dp ON dp.id=o.delivery_person_id
     LEFT JOIN order_items i ON i.order_id=o.id
     ${scope}
     GROUP BY o.id, dp.full_name, dp.phone
     ORDER BY o.created_at DESC`,
  );
  res.json({ deliveries: rows });
}));

router.get('/:orderId/assignment-history', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const orderId = orderIdSchema.parse(req.params.orderId);
  const { rows: order } = await pool.query('SELECT id FROM orders WHERE id=$1', [orderId]);
  if (!order[0]) throw new HttpError(404, 'Order not found.');

  const { rows } = await pool.query(
    `SELECT e.id, e.from_status AS "fromStatus", e.to_status AS "toStatus",
            CASE
              WHEN e.action_type='STATUS_CHANGED' AND e.to_status='assigned' THEN 'ASSIGNED'
              WHEN e.action_type='STATUS_CHANGED' AND e.to_status='unassigned' THEN 'UNASSIGNED'
              ELSE e.action_type
            END AS "actionType",
            e.actor_role AS "actorRole", e.note,
            e.created_at AS "createdAt",
            actor.full_name AS "assignedBy",
            previous_person.full_name AS "previousDeliveryPerson",
            new_person.full_name AS "deliveryPerson"
     FROM order_delivery_events e
     LEFT JOIN users actor ON actor.id=e.actor_id
     LEFT JOIN users previous_person
       ON previous_person.id=COALESCE(
         e.previous_delivery_person_id,
         CASE WHEN e.to_status='unassigned' THEN e.delivery_person_id END
       )
     LEFT JOIN users new_person
       ON new_person.id=CASE WHEN e.to_status='unassigned' THEN NULL ELSE e.delivery_person_id END
     WHERE e.order_id=$1
       AND (e.action_type IN ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED')
            OR e.to_status IN ('assigned', 'unassigned'))
     ORDER BY e.created_at DESC`,
    [orderId],
  );
  res.json({ history: rows });
}));

router.post('/:orderId/assign', authenticate, requirePermission('ASSIGN_DELIVERIES'), asyncHandler(async (req, res) => {
  const orderId = orderIdSchema.parse(req.params.orderId);
  const { deliveryPersonId } = assignSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: people } = await client.query(
      `SELECT id FROM users
       WHERE id=$1 AND role='delivery_person' AND is_active=true
       FOR UPDATE`,
      [deliveryPersonId],
    );
    if (!people[0]) throw new HttpError(400, 'Delivery person not found or inactive.');

    const { rows: orderRows } = await client.query(
      `SELECT id, status, payment_method AS "paymentMethod",
              delivery_status AS "deliveryStatus", delivery_person_id AS "deliveryPersonId"
       FROM orders WHERE id=$1 FOR UPDATE`,
      [orderId],
    );
    const order = orderRows[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (req.user.role === 'employee'
      && order.deliveryPersonId
      && order.deliveryPersonId !== deliveryPersonId
      && !hasDeliveryPermission(req.user.role, req.user.permissions, 'REASSIGN_DELIVERIES')) {
      throw new HttpError(403, 'Reassigning deliveries requires additional permission.');
    }
    if (order.status !== 'ready') {
      throw new HttpError(409, 'Only orders marked ready for delivery can be assigned.');
    }
    if (!['unassigned', 'assigned', 'failed', 'returned'].includes(order.deliveryStatus)) {
      throw new HttpError(409, `A delivery in '${order.deliveryStatus}' status cannot be reassigned.`);
    }
    await assertOrderPaymentVerified(client, order,
      'Verify the order payment before assigning this delivery.');
    if (order.deliveryStatus === 'assigned' && order.deliveryPersonId === deliveryPersonId) {
      await client.query('COMMIT');
      return res.json({ delivery: { id: orderId, deliveryPersonId, deliveryStatus: 'assigned' } });
    }
    const { rows } = await client.query(
      `UPDATE orders
       SET delivery_person_id=$1, assigned_at=NOW(), delivery_status='assigned',
           failure_reason='', updated_at=NOW()
       WHERE id=$2
       RETURNING id, order_number AS "orderNumber", status,
                 delivery_status AS "deliveryStatus", delivery_note AS "deliveryNote",
                 assigned_at AS "assignedAt", delivery_person_id AS "deliveryPersonId"`,
      [deliveryPersonId, orderId],
    );
    const actionType = order.deliveryPersonId && order.deliveryPersonId !== deliveryPersonId
      ? 'REASSIGNED'
      : 'ASSIGNED';
    await client.query(
      `INSERT INTO order_delivery_events(
         order_id, actor_id, delivery_person_id, previous_delivery_person_id,
         actor_role, action_type, from_status, to_status, note
       )
       VALUES($1, $2, $3, $4, $5, $6, $7, 'assigned', $8)`,
      [
        orderId,
        req.user.id,
        deliveryPersonId,
        order.deliveryPersonId,
        req.user.role,
        actionType,
        order.deliveryStatus,
        actionType === 'REASSIGNED' ? 'Reassigned by administrator or authorized employee.' : 'Assigned by administrator or authorized employee.',
      ],
    );
    await client.query('COMMIT');
    res.json({ delivery: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.delete('/:orderId/assign', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const orderId = orderIdSchema.parse(req.params.orderId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, status, delivery_status AS "deliveryStatus",
              delivery_person_id AS "deliveryPersonId"
       FROM orders WHERE id=$1 FOR UPDATE`,
      [orderId],
    );
    const order = rows[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status !== 'ready' || !order.deliveryPersonId
      || !['assigned', 'failed', 'returned'].includes(order.deliveryStatus)) {
      throw new HttpError(409, 'Only an unaccepted, failed, or returned assignment for a ready order can be removed.');
    }
    const fromStatus = order.deliveryStatus;
    await client.query(
      `UPDATE orders
       SET delivery_person_id=NULL, assigned_at=NULL, delivery_status='unassigned', updated_at=NOW()
       WHERE id=$1`,
      [orderId],
    );
    await client.query(
      `INSERT INTO order_delivery_events(
         order_id, actor_id, delivery_person_id, previous_delivery_person_id,
         actor_role, action_type, from_status, to_status, note
       )
       VALUES($1, $2, NULL, $3, $4, 'UNASSIGNED', $5, 'unassigned', 'Assignment removed by administrator.')`,
       [orderId, req.user.id, order.deliveryPersonId, req.user.role, fromStatus],
    );
    await client.query('COMMIT');
    res.json({ delivery: { id: orderId, deliveryPersonId: null, deliveryStatus: 'unassigned' } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
