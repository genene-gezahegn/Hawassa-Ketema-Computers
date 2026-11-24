BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_confirmation_status VARCHAR(32)
    CHECK (customer_confirmation_status IN (
      'awaiting_confirmation',
      'customer_confirmed',
      'issue_reported'
    )),
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_confirmation_user_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_delivery_issue TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_delivery_issue_reported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_customer_confirmation_idx
  ON public.orders(customer_confirmation_status, delivered_at DESC)
  WHERE customer_confirmation_status IS NOT NULL;

COMMIT;
