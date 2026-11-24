-- =================================================================
-- MIGRATION: Customer portal — cancellation & return requests
-- Safe to run multiple times (IF NOT EXISTS throughout).
-- =================================================================

BEGIN;

-- 1. Cancellation requests (customer-initiated, admin approves)
CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id),
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_cancellations_order_idx
  ON public.order_cancellations(order_id);
CREATE INDEX IF NOT EXISTS order_cancellations_customer_idx
  ON public.order_cancellations(customer_id, created_at DESC);

-- 2. Return requests (after delivery, customer requests return)
CREATE TABLE IF NOT EXISTS public.order_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id),
  items JSONB NOT NULL DEFAULT '[]',  -- [{productId, name, quantity, reason}]
  reason VARCHAR(60) NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested','under_review','approved','rejected',
      'return_received','refund_processing','refunded'
    )),
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_returns_order_idx
  ON public.order_returns(order_id);
CREATE INDEX IF NOT EXISTS order_returns_customer_idx
  ON public.order_returns(customer_id, created_at DESC);

-- 3. Add cancellation_status to orders so customers can see
--    "Cancellation Requested" state without changing main status
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(24)
    CHECK (cancellation_status IN ('requested','approved','rejected'));

COMMIT;
