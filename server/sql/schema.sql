
-- =====================================================
-- HAWASSA-KETEMA COMPUTERS
-- PostgreSQL Database Schema
-- Backend: Node.js + Express
-- Database: PostgreSQL
-- =====================================================

BEGIN;

-- 1. UUID GENERATION
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 2. USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    password_reset_token_hash VARCHAR(64),
    password_reset_expires_at TIMESTAMPTZ,
    role VARCHAR(20) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('admin', 'customer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

-- =====================================================
-- 3. CATEGORIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. PRODUCTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id VARCHAR(80) UNIQUE,
    sku VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    brand VARCHAR(100) NOT NULL DEFAULT '',
    model VARCHAR(120) NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'Accessories',
    description TEXT NOT NULL DEFAULT '',
    specs TEXT NOT NULL DEFAULT '',
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 5
        CHECK (reorder_level >= 0),
    product_photo TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support existing installations
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS legacy_id VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS products_legacy_id_idx
ON public.products(legacy_id);

CREATE INDEX IF NOT EXISTS products_category_idx
ON public.products(category);

CREATE INDEX IF NOT EXISTS products_active_idx
ON public.products(is_active);

-- =====================================================
-- 5. ORDERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) NOT NULL UNIQUE,

    customer_id UUID NOT NULL
        REFERENCES public.users(id),

    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    delivery_address TEXT NOT NULL,

    payment_method VARCHAR(40) NOT NULL
        DEFAULT 'Cash on delivery',

    status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'confirmed',
            'processing',
            'ready',
            'completed',
            'cancelled'
        )),

    subtotal NUMERIC(12,2) NOT NULL
        CHECK (subtotal >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_customer_idx
ON public.orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_status_idx
ON public.orders(status);

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_idempotency_key_idx
ON public.orders(customer_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- =====================================================
-- 6. ORDER ITEMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES public.orders(id) ON DELETE CASCADE,

    product_id UUID NOT NULL
        REFERENCES public.products(id),

    product_name VARCHAR(180) NOT NULL,
    sku VARCHAR(80) NOT NULL,

    quantity INTEGER NOT NULL CHECK (quantity > 0),

    unit_price NUMERIC(12,2) NOT NULL
        CHECK (unit_price >= 0),

    line_total NUMERIC(12,2) NOT NULL
        CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx
ON public.order_items(order_id);

-- =====================================================
-- 7. STOCK MOVEMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES public.products(id),

    user_id UUID
        REFERENCES public.users(id),

    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN (
            'stock_in',
            'stock_out',
            'order',
            'adjustment'
        )),

    quantity_change INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx
ON public.stock_movements(product_id, created_at DESC);

-- =====================================================
-- 8. ORDER PAYMENTS TABLE
-- Manual bank transfer and receipt verification
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES public.orders(id) ON DELETE CASCADE,

    customer_id UUID NOT NULL
        REFERENCES public.users(id),

    bank_code VARCHAR(30) NOT NULL,

    transaction_reference VARCHAR(180) NOT NULL,

    sender_name VARCHAR(120) NOT NULL DEFAULT '',

    receipt_mime VARCHAR(80),

    receipt_data BYTEA,

    status VARCHAR(24) NOT NULL DEFAULT 'pending_review'
        CHECK (status IN (
            'pending_review',
            'verified',
            'rejected'
        )),

    verification_provider VARCHAR(40),

    verification_payload JSONB,

    reviewer_id UUID
        REFERENCES public.users(id),

    review_note TEXT NOT NULL DEFAULT '',

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_bank_transaction
        UNIQUE (bank_code, transaction_reference)
);

-- IMPORTANT: Create indexes AFTER the table.

CREATE INDEX IF NOT EXISTS order_payments_order_idx
ON public.order_payments(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_payments_status_idx
ON public.order_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS order_payments_customer_idx
ON public.order_payments(customer_id, created_at DESC);

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

-- =====================================================
-- 9. PAYO HOSTED BANK-TRANSFER PAYMENTS
-- =====================================================

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

-- =====================================================
-- 10. DEFAULT PRODUCT CATEGORIES
-- =====================================================

INSERT INTO public.categories(name)
VALUES
    ('Laptop'),
    ('Desktop'),
    ('Power Solutions'),
    ('Accessories')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 11. COMMIT DATABASE TRANSACTION
-- =====================================================

COMMIT;

-- =====================================================
-- 11. DATABASE VERIFICATION
-- =====================================================

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
