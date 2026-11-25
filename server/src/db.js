import pg from 'pg';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
}
const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const useSsl = process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true';
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error));
