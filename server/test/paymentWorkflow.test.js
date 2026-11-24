import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

test('secures receipt ownership and records administrator rejection, resubmission, and approval', async t => {
  const secret = 'manual-payment-test-secret-that-is-long-enough';
  process.env.JWT_SECRET = secret;
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost/test';

  const [{ default: paymentRoutes }, { pool }] = await Promise.all([
    import('../src/routes/payments.js'),
    import('../src/db.js'),
  ]);
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  const orderId = 'c2a1e8c1-cdf3-40f7-8a11-38cb2e5abdd3';
  const paymentId = 'd3a1e8c1-cdf3-40f7-8a11-38cb2e5abdd3';
  const customerId = 'e4a1e8c1-cdf3-40f7-8a11-38cb2e5abdd3';
  const otherCustomerId = 'f5a1e8c1-cdf3-40f7-8a11-38cb2e5abdd3';
  const adminId = 'a6a1e8c1-cdf3-40f7-8a11-38cb2e5abdd3';
  const users = new Map([
    [customerId, { id: customerId, full_name: 'Customer One', email: 'one@example.test', phone: '', role: 'customer', is_active: true }],
    [otherCustomerId, { id: otherCustomerId, full_name: 'Customer Two', email: 'two@example.test', phone: '', role: 'customer', is_active: true }],
    [adminId, { id: adminId, full_name: 'Store Admin', email: 'admin@example.test', phone: '', role: 'admin', is_active: true }],
  ]);
  const events = [];
  let payment = null;
  const receiptBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

  pool.query = async (sql, values = []) => {
    const query = String(sql);
    if (query.includes('SELECT id, full_name, email, phone, role, is_active FROM users')) {
      return { rows: users.has(values[0]) ? [users.get(values[0])] : [] };
    }
    if (query.includes('SELECT p.receipt_mime AS "receiptMime"')) {
      if (values[1] !== customerId || values[0] !== orderId || !payment?.receiptData) return { rows: [] };
      return { rows: [{ receiptMime: payment.receiptMime, receiptData: payment.receiptData }] };
    }
    if (query.includes('SELECT receipt_mime,receipt_data FROM order_payments')) {
      if (values[0] !== paymentId || !payment?.receiptData) return { rows: [] };
      return { rows: [{ receipt_mime: payment.receiptMime, receipt_data: payment.receiptData }] };
    }
    if (query.includes('FROM order_payment_reviews h')) {
      return { rows: events.map((event, index) => ({
        id: `review-${index + 1}`,
        orderId,
        orderNumber: 'HK-TEST',
        reference: payment?.reference || 'TXN-12345',
        amount: 125,
        ...event,
      })) };
    }
    if (query.includes('FROM payo_payments')) return { rows: [] };
    throw new Error(`Unexpected pool query in payment workflow test: ${query}`);
  };

  pool.connect = async () => ({
    async query(sql, values = []) {
      const query = String(sql);
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(query.trim())) return { rows: [] };
      if (query.includes('FROM orders WHERE id=$1 AND customer_id=$2 FOR UPDATE')) {
        return { rows: values[0] === orderId && values[1] === customerId
          ? [{ id: orderId, customerId, paymentMethod: 'Bank transfer', status: 'pending' }]
          : [] };
      }
      if (query.includes("FROM order_payments WHERE order_id=$1 AND status='verified' LIMIT 1")) {
        return { rows: payment?.status === 'verified' ? [{ id: paymentId }] : [] };
      }
      if (query.includes("FROM order_payments WHERE order_id=$1 AND status='pending_review' LIMIT 1")) {
        return { rows: payment?.status === 'pending_review'
          ? [{ id: paymentId, hasReceipt: Boolean(payment.receiptData) }]
          : [] };
      }
      if (query.includes('FROM order_payments WHERE bank_code=$1 AND transaction_reference=$2 FOR UPDATE')) {
        return { rows: payment?.bank === values[0] && payment.reference === values[1]
          ? [{ id: paymentId, orderId, status: payment.status }]
          : [] };
      }
      if (query.includes('INSERT INTO order_payments')) {
        payment = {
          id: paymentId,
          customerId: values[1],
          bank: values[2],
          reference: values[3],
          receiptMime: values[5],
          receiptData: values[6],
          status: 'pending_review',
        };
        return { rows: [{ id: paymentId, status: payment.status, createdAt: new Date().toISOString() }] };
      }
      if (query.includes('SET sender_name=$1') && query.includes("status='pending_review'")) {
        payment.receiptMime = values[1];
        payment.receiptData = values[2];
        payment.status = 'pending_review';
        return { rows: [{ id: paymentId, status: payment.status, createdAt: new Date().toISOString() }] };
      }
      if (query.includes('SET status=$1::varchar(24)')) {
        payment.status = values[0];
        payment.reviewerId = values[1];
        payment.reviewNote = values[2];
        return { rows: [{ id: paymentId, status: payment.status, reviewNote: payment.reviewNote }] };
      }
      if (query.includes('SELECT p.id, p.order_id AS "orderId", p.status')) {
        return { rows: payment ? [{ id: paymentId, orderId, status: payment.status }] : [] };
      }
      if (query.includes("status='verified' AND id<>$2")) return { rows: [] };
      if (query.includes('INSERT INTO order_payment_reviews')) {
        events.push({
          action: values[2],
          note: values[3],
          reviewerName: users.get(values[1])?.full_name || null,
          reviewedAt: new Date().toISOString(),
        });
        return { rows: [] };
      }
      if (query.includes('UPDATE order_payments')) {
        payment.status = 'pending_review';
        return { rows: [{ id: paymentId, status: payment.status, createdAt: new Date().toISOString() }] };
      }
      throw new Error(`Unexpected client query in payment workflow test: ${query}`);
    },
    release() {},
  });

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use('/payments', paymentRoutes);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/payments`;
  const tokenFor = id => jwt.sign({ sub: id }, secret);
  const request = (url, userId, options = {}) => fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenFor(userId)}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const bodyFor = reference => JSON.stringify({
    bank: 'cbe',
    reference,
    senderName: 'Customer One',
    receiptMime: 'image/jpeg',
    receiptData: receiptBytes.toString('base64'),
  });

  const forbiddenReceipt = await request(`/orders/${orderId}/receipt`, otherCustomerId, {
    method: 'POST',
    body: bodyFor('TXN-12345'),
  });
  assert.equal(forbiddenReceipt.status, 404);

  const submitted = await request(`/orders/${orderId}/receipt`, customerId, {
    method: 'POST',
    body: bodyFor('TXN-12345'),
  });
  assert.equal(submitted.status, 201);
  assert.equal(payment.status, 'pending_review');
  assert.deepEqual(payment.receiptData, receiptBytes);

  const ownReceipt = await request(`/orders/${orderId}/receipt`, customerId);
  assert.equal(ownReceipt.status, 200);
  assert.deepEqual(Buffer.from(await ownReceipt.arrayBuffer()), receiptBytes);
  const anotherReceipt = await request(`/orders/${orderId}/receipt`, otherCustomerId);
  assert.equal(anotherReceipt.status, 404);
  const adminReceipt = await request(`/admin/${paymentId}/receipt`, adminId);
  assert.equal(adminReceipt.status, 200);
  assert.deepEqual(Buffer.from(await adminReceipt.arrayBuffer()), receiptBytes);
  const customerAdminReceipt = await request(`/admin/${paymentId}/receipt`, customerId);
  assert.equal(customerAdminReceipt.status, 403);
  const customerReview = await request(`/admin/${paymentId}/review`, customerId, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'approve', note: 'Not an administrator.' }),
  });
  assert.equal(customerReview.status, 403);

  const noReason = await request(`/admin/${paymentId}/review`, adminId, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'reject', note: '' }),
  });
  assert.equal(noReason.status, 400);
  const rejected = await request(`/admin/${paymentId}/review`, adminId, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'reject', note: 'Receipt amount is unclear.' }),
  });
  assert.equal(rejected.status, 200);
  assert.equal(payment.status, 'rejected');
  assert.equal(events[0].action, 'rejected');

  const resubmitted = await request(`/orders/${orderId}/receipt`, customerId, {
    method: 'POST',
    body: bodyFor('TXN-12345'),
  });
  assert.equal(resubmitted.status, 201);
  assert.equal(payment.status, 'pending_review');
  const approved = await request(`/admin/${paymentId}/review`, adminId, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'approve', note: 'Funds confirmed in the bank account.' }),
  });
  assert.equal(approved.status, 200);
  assert.equal(payment.status, 'verified');
  assert.equal(events[1].action, 'approved');
  assert.equal(events[1].reviewerName, 'Store Admin');

  const history = await request('/admin/review-history', adminId);
  assert.equal(history.status, 200);
  assert.equal((await history.json()).history.length, 2);

  const replacementAfterApproval = await request(`/orders/${orderId}/receipt`, customerId, {
    method: 'POST',
    body: bodyFor('TXN-99999'),
  });
  assert.equal(replacementAfterApproval.status, 409);

  const removedCheckout = await request(`/orders/${orderId}/payo`, customerId, { method: 'POST' });
  assert.equal(removedCheckout.status, 404);
});
