/**
 * Employee Routes — /api/employee
 * Employees can view all orders and update status to processing/ready.
 * They can also view products and inventory (read-only from existing /api/products).
 */
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getEmployeePermissions } from '../middleware/permissions.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { canTransitionEmployeeOrderStatus } from '../utils/employeeOrderWorkflow.js';
import { assertOrderPaymentVerified } from '../utils/orderPayment.js';

const router = Router();
router.use(authenticate, requireRole('employee'));

router.get('/permissions', asyncHandler(async (req, res) => {
  res.json({ permissions: await getEmployeePermissions(req.user.id) });
}));

/* ── GET /api/employee/orders — view all orders (for processing) ── */
router.get('/orders', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
       o.phone, o.delivery_address AS "deliveryAddress", o.status,
       o.delivery_status AS "deliveryStatus", o.payment_method AS "paymentMethod",
       o.delivery_person_id AS "deliveryPersonId",
       dp.full_name AS "deliveryPersonName", o.assigned_at AS "assignedAt",
       CASE WHEN assignment_actor.actor_id=$1 THEN o.customer_confirmation_status END AS "customerConfirmationStatus",
       CASE WHEN assignment_actor.actor_id=$1 THEN o.customer_confirmed_at END AS "customerConfirmedAt",
       CASE WHEN assignment_actor.actor_id=$1 THEN o.customer_delivery_issue END AS "customerDeliveryIssue",
       CASE WHEN assignment_actor.actor_id=$1 THEN o.customer_delivery_issue_reported_at END AS "customerDeliveryIssueReportedAt",
       o.subtotal::float AS total,
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
       COALESCE(
         json_agg(
           json_build_object(
             'productId', i.product_id,
             'name', i.product_name,
             'sku', i.sku,
             'quantity', i.quantity,
             'unitPrice', i.unit_price::float
           )
         ) FILTER (WHERE i.id IS NOT NULL), '[]'
       ) AS items
     FROM orders o
     LEFT JOIN order_items i ON i.order_id = o.id
     LEFT JOIN users dp ON dp.id=o.delivery_person_id
     LEFT JOIN LATERAL (
       SELECT e.actor_id
       FROM order_delivery_events e
       WHERE e.order_id=o.id
         AND (e.action_type IN ('ASSIGNED','REASSIGNED')
              OR (e.action_type='STATUS_CHANGED' AND e.to_status='assigned'))
       ORDER BY e.created_at DESC
       LIMIT 1
     ) assignment_actor ON TRUE
     GROUP BY o.id, dp.full_name, assignment_actor.actor_id
     ORDER BY o.created_at DESC`,
    [req.user.id],
  );
  res.json({ orders: rows });
}));

/* ── PATCH /api/employee/orders/:id/status — confirm and fulfill orders ── */
router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const { status } = z.object({
    status: z.enum(['confirmed', 'processing', 'ready']),
  }).parse(req.body);
  const orderId = z.string().uuid().parse(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: foundRows } = await client.query(
      'SELECT id, status, payment_method AS "paymentMethod" FROM orders WHERE id=$1 FOR UPDATE',
      [orderId],
    );
    const order = foundRows[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (!canTransitionEmployeeOrderStatus(order.status, status)) {
      throw new HttpError(409, `Cannot move order from '${order.status}' to '${status}'.`);
    }

    await assertOrderPaymentVerified(client, { id: orderId, paymentMethod: order.paymentMethod },
      'Payment must be verified before an employee can confirm or fulfill this order.');

    const { rows } = await client.query(
      `UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2
       RETURNING id, order_number AS "orderNumber", status, updated_at AS "updatedAt"`,
      [status, orderId],
    );
    await client.query('COMMIT');
    res.json({ order: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/* ── GET /api/employee/dashboard — employee summary stats ── */
router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [pending, processing, ready] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE status IN ('pending','confirmed')`),
    pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE status='processing'`),
    pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE status='ready'`),
  ]);
  res.json({
    stats: {
      toProcess: pending.rows[0].count,
      inProgress: processing.rows[0].count,
      readyForDelivery: ready.rows[0].count,
    },
  });
}));

export default router;
