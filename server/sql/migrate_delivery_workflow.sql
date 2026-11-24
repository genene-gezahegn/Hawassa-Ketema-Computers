BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.order_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  delivery_person_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_status VARCHAR(24),
  to_status VARCHAR(24) NOT NULL
    CHECK (to_status IN ('unassigned', 'assigned', 'accepted', 'out_for_delivery', 'delivered', 'failed', 'returned')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_delivery_events_order_idx
  ON public.order_delivery_events(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_delivery_events_person_idx
  ON public.order_delivery_events(delivery_person_id, created_at DESC);

COMMIT;
