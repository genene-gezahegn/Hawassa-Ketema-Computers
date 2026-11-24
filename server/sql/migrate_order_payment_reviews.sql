BEGIN;

CREATE TABLE IF NOT EXISTS public.order_payment_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL
        REFERENCES public.order_payments(id) ON DELETE CASCADE,
    reviewer_id UUID
        REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(16) NOT NULL
        CHECK (action IN ('approved', 'rejected')),
    note TEXT NOT NULL DEFAULT '',
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_order_payment_review_event
        UNIQUE (payment_id, action, reviewed_at)
);

CREATE INDEX IF NOT EXISTS order_payment_reviews_payment_idx
ON public.order_payment_reviews(payment_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS order_payment_reviews_reviewed_idx
ON public.order_payment_reviews(reviewed_at DESC);

INSERT INTO public.order_payment_reviews(payment_id, reviewer_id, action, note, reviewed_at)
SELECT p.id, p.reviewer_id,
       CASE WHEN p.status='verified' THEN 'approved' ELSE 'rejected' END,
       p.review_note,
       COALESCE(p.verified_at, p.updated_at, p.created_at)
FROM public.order_payments p
WHERE p.status IN ('verified', 'rejected')
ON CONFLICT (payment_id, action, reviewed_at) DO NOTHING;

COMMIT;
