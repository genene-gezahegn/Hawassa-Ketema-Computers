BEGIN;

CREATE TABLE IF NOT EXISTS public.payo_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    customer_id UUID NOT NULL REFERENCES public.users(id),
    payment_reference VARCHAR(80) NOT NULL UNIQUE,
    payo_order_id VARCHAR(120) UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'rejected', 'expired')),
    payment_url TEXT,
    transaction_reference VARCHAR(180),
    sender_name VARCHAR(120) NOT NULL DEFAULT '',
    initialization_error VARCHAR(40),
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payo_payments_order_idx
ON public.payo_payments(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payo_payments_customer_idx
ON public.payo_payments(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payo_payments_status_idx
ON public.payo_payments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payo_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payo_payment_id UUID NOT NULL REFERENCES public.payo_payments(id),
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_status VARCHAR(16) NOT NULL CHECK (event_status IN ('APPROVED', 'REJECTED')),
    amount NUMERIC(12,2) NOT NULL,
    transaction_reference VARCHAR(180),
    sender_name VARCHAR(120) NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payo_webhook_events_payment_idx
ON public.payo_webhook_events(payo_payment_id, received_at DESC);

COMMIT;
