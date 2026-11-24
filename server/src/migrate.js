import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

try {
  // Apply the main schema (idempotent — uses IF NOT EXISTS / IF NOT EXISTS)
  await pool.query(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  console.log('Database schema is ready.');

  await pool.query(await readFile(new URL('../sql/migrate_roles.sql', import.meta.url), 'utf8'));
  console.log('Staff roles and delivery assignments are ready.');

  await pool.query(await readFile(new URL('../sql/migrate_delivery_workflow.sql', import.meta.url), 'utf8'));
  console.log('Delivery workflow history is ready.');

  await pool.query(await readFile(new URL('../sql/migrate_customer_delivery_confirmation.sql', import.meta.url), 'utf8'));
  console.log('Customer delivery confirmations are ready.');

  await pool.query(await readFile(new URL('../sql/migrate_employee_delivery_permissions.sql', import.meta.url), 'utf8'));
  console.log('Employee delivery permissions and assignment audit details are ready.');

  await pool.query(await readFile(new URL('../sql/migrate_payo_payments.sql', import.meta.url), 'utf8'));
  console.log('Legacy payment records are ready.');

  await pool.query(await readFile(new URL('../sql/migrate_order_payment_reviews.sql', import.meta.url), 'utf8'));
  console.log('Bank-transfer payment review history is ready.');

  await pool.query(await readFile(new URL('../sql/migrate_order_messages.sql', import.meta.url), 'utf8'));
  console.log('Order-specific customer and delivery messages are ready.');

  // Belt-and-suspenders: ensure password-reset columns exist even on databases
  // that were created before this feature was added to schema.sql
  await pool.query(`
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
  `);
  console.log('Password-reset columns: verified.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
