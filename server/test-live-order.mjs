/**
 * Live end-to-end test: logs in as the customer and places a COD order.
 * Run: node test-live-order.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const BASE = `http://localhost:4000/api`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── 1. Find a real customer account ──────────────────────────────────────────
const { rows: customers } = await pool.query(
  "SELECT id, email FROM users WHERE role='customer' AND is_active=true LIMIT 1"
);
if (!customers[0]) { console.error('No customer found. Register one first.'); process.exit(1); }
console.log('Customer:', customers[0].email);

// ── 2. Find a real product with stock ────────────────────────────────────────
const { rows: products } = await pool.query(
  "SELECT id, name, price, stock_quantity FROM products WHERE is_active=true AND stock_quantity > 0 LIMIT 1"
);
if (!products[0]) { console.error('No product with stock found.'); process.exit(1); }
console.log('Product:', products[0].name, '| price:', products[0].price, '| stock:', products[0].stock_quantity);

// ── 3. Log in to get a JWT ────────────────────────────────────────────────────
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: customers[0].email, password: '123456789' }),
});
if (!loginRes.ok) {
  const e = await loginRes.json();
  console.error('Login failed (try a different password):', e.message);
  console.log('\nSkipping auth test — testing schema validation directly:\n');

  // Test just the schema without a real token
  const { z } = await import('zod');
  const orderSchema = z.object({
    customerName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(30),
    deliveryAddress: z.string().trim().min(5).max(500),
    paymentMethod: z.enum(['Cash on delivery','Bank transfer','Pay on pickup']).default('Cash on delivery'),
    items: z.array(z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(100)
    })).min(1).max(30)
  });

  const payloads = [
    { label: 'All valid',
      data: { customerName:'Genene Gezahegn', phone:'0912345678', deliveryAddress:'SIDAMA, hawassa', paymentMethod:'Cash on delivery', items:[{productId:products[0].id, quantity:1}] }},
    { label: 'Pay on pickup',
      data: { customerName:'Genene Gezahegn', phone:'0912345678', deliveryAddress:'SIDAMA, hawassa', paymentMethod:'Pay on pickup', items:[{productId:products[0].id, quantity:1}] }},
    { label: 'Short address',
      data: { customerName:'Genene Gezahegn', phone:'0912345678', deliveryAddress:'SID', paymentMethod:'Cash on delivery', items:[{productId:products[0].id, quantity:1}] }},
    { label: 'Short phone',
      data: { customerName:'Genene Gezahegn', phone:'091', paymentMethod:'Cash on delivery', deliveryAddress:'SIDAMA, hawassa', items:[{productId:products[0].id, quantity:1}] }},
    { label: 'quantity as string (bug test)',
      data: { customerName:'Genene Gezahegn', phone:'0912345678', deliveryAddress:'SIDAMA, hawassa', paymentMethod:'Cash on delivery', items:[{productId:products[0].id, quantity:'1'}] }},
  ];

  for (const p of payloads) {
    try {
      orderSchema.parse(p.data);
      console.log(`  ✓ ${p.label}`);
    } catch (e) {
      console.log(`  ✗ ${p.label}:`);
      e.issues.forEach(i => console.log(`      field=${i.path.join('.')} — ${i.message}`));
    }
  }

  await pool.end();
  process.exit(0);
}

const { token } = await loginRes.json();
console.log('Logged in OK, token obtained.\n');

// ── 4. Submit a real order ────────────────────────────────────────────────────
const payload = {
  customerName: 'Genene Gezahegn',
  phone: '0912345678',
  deliveryAddress: 'SIDAMA, hawassa',
  paymentMethod: 'Cash on delivery',
  items: [{ productId: products[0].id, quantity: 1 }],
};
console.log('Sending payload:', JSON.stringify(payload, null, 2));

const orderRes = await fetch(`${BASE}/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});
const orderData = await orderRes.json();
console.log('\nResponse status:', orderRes.status);
console.log('Response body:', JSON.stringify(orderData, null, 2));

if (orderRes.ok) {
  console.log('\n✓ ORDER CREATED SUCCESSFULLY:', orderData.order?.orderNumber);
  // Restore stock
  await pool.query('UPDATE products SET stock_quantity=stock_quantity+1 WHERE id=$1', [products[0].id]);
  await pool.query('DELETE FROM orders WHERE id=$1', [orderData.order?.id]);
  console.log('✓ Test order cleaned up.');
} else {
  console.log('\n✗ ORDER FAILED');
  if (orderData.errors) {
    orderData.errors.forEach(e => console.log(`  field=${e.field} — ${e.message}`));
  }
}

await pool.end();
