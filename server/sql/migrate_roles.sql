-- =============================================================
-- MIGRATION: Add employee and delivery_person roles
-- Safe to run multiple times (all statements use IF NOT EXISTS
-- or DROP/ADD constraint pattern).
-- =============================================================

BEGIN;

-- 1. Widen the users.role CHECK constraint to include new roles
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'customer', 'employee', 'delivery_person'));

-- 2. Add delivery assignment columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_person_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(24)
    NOT NULL DEFAULT 'unassigned'
    CHECK (delivery_status IN (
      'unassigned',
      'assigned',
      'accepted',
      'out_for_delivery',
      'delivered',
      'failed',
      'returned'
    ));

-- 3. Index for delivery-person queries
CREATE INDEX IF NOT EXISTS orders_delivery_person_idx
  ON public.orders(delivery_person_id, created_at DESC);

COMMIT;
