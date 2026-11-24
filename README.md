# Hawassa-Ketema Computers

A full-stack storefront and inventory-management application for a computer retailer in Hawassa, Ethiopia. The original React storefront and inventory interface are preserved; a Node.js/Express API and PostgreSQL data layer have been added.

## Architecture

- **Frontend:** React 19, TypeScript, Vite, Zustand, Tailwind CSS
- **Backend:** Node.js (ES modules), Express
- **Database:** PostgreSQL
- **Authentication:** bcrypt password hashing + signed JWT access tokens
- **Authorization:** server-side role-based access control (`admin`, `customer`)

## Important security behavior

- Public registration always creates a `customer`; clients cannot select or submit an administrator role.
- Administrator accounts are provisioned only with the private `create-admin` command.
- Product browsing is public. Product create/update/archive and admin reporting require an authenticated administrator.
- Creating an order and viewing `/api/orders/mine` require an authenticated customer.
- The API derives the customer identity from the verified token; it never trusts a customer ID supplied in an order request.
- Order creation locks product rows, checks current stock, stores price snapshots, decrements stock, records stock movements, and commits atomically.
- Customers can only retrieve their own orders. All-orders and status-management endpoints require admin role. Cancelling an order restores its reserved quantities and records stock movements in the same database transaction.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- npm

## 1. Configure PostgreSQL

Create a database, for example:

```sql
CREATE DATABASE hawassa_ketema;
```

## 2. Configure and start the API

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and set a strong `JWT_SECRET`, your PostgreSQL `DATABASE_URL`, and `CLIENT_ORIGIN`. For hosted PostgreSQL such as Neon, set `DATABASE_SSL=true`; this enforces certificate-verified TLS. Configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` together with a verified sender in Resend to enable password resets and notification emails. Production startup requires both Resend settings and an HTTPS `CLIENT_ORIGIN`. To verify real email delivery, set `RESEND_TEST_TO` to an inbox you control and run `npm run test:email:delivery` from `server`; this sends a real test message. To enable Google sign-in, set `GOOGLE_CLIENT_ID` to a Google OAuth client ID for a web application and add the storefront origin as an authorized JavaScript origin. `CLIENT_URL` may be set to the public storefront URL if it differs from the first `CLIENT_ORIGIN`.

Run the schema migration:

```bash
npm run migrate
```

Create the first administrator. Set these variables in `server/.env` before running the command:

```env
ADMIN_NAME=Store Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-unique-password-at-least-12-characters
```

```bash
npm run create-admin
npm run dev
```

Use `npm run seed-demo` only for local/demo databases; do not run it against production unless demo products are deliberately wanted.

API health check: `http://localhost:4000/api/health`.

## 3. Start the frontend

In a second terminal, from the project root:

```bash
npm install
```

Copy root `.env.example` to `.env` and set `VITE_API_URL=http://localhost:4000/api` for local development. In Vercel, set the production environment variable `VITE_API_URL` to the Render API base URL, for example `https://your-api.onrender.com/api`, then rebuild and redeploy the frontend. Production builds no longer fall back to `localhost:4000`.

```bash
npm run dev
```

Open `http://localhost:5173`.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register customer |
| POST | `/api/auth/login` | Public | Sign in |
| POST | `/api/auth/forgot-password` | Public | Email a one-time password reset link |
| POST | `/api/auth/reset-password` | Public | Reset password using an unexpired link |
| GET | `/api/auth/google/config` | Public | Read Google sign-in client configuration |
| POST | `/api/auth/google` | Public | Verify Google sign-in and create/sign in a customer |
| GET | `/api/auth/me` | Authenticated | Current account |
| GET | `/api/products` | Public | Browse active products |
| GET | `/api/products/:id` | Public | Product detail |
| POST | `/api/products` | Admin | Create product |
| PATCH | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Archive product |
| POST | `/api/orders` | Customer | Place order |
| GET | `/api/orders/mine` | Customer | Own order history |
| GET | `/api/orders` | Admin | All orders |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |
| GET | `/api/admin/dashboard` | Admin | Dashboard statistics |
| GET | `/api/admin/customers` | Admin | Customer list |
| PATCH | `/api/admin/customers/:id/status` | Admin | Activate/deactivate customer |

All protected API requests use `Authorization: Bearer <token>`.

## Verification

From the project root:

```bash
npm test
npm run test:backend
npm run build
```

`npm test` runs only frontend tests; `npm run test:backend` runs the API's Node test suite separately. For production database updates, run the existing `npm run migrate` command in `server` against the production `DATABASE_URL` before deploying the API. This project uses SQL migrations through that script, not Prisma migrations. Create the production administrator with `npm run create-admin`; do not run demo seed data unless intended.

The API has its own `server/package.json` and is started separately from Vite. Run `npm run seed-demo` again whenever you want to refresh the database from the bundled sample catalog; existing products are matched by SKU. Run `npm run migrate` after updating the API to add the password-reset token fields to an existing database.

## Production checklist

Before a public launch: use HTTPS, set a strong unique JWT secret, restrict CORS to the deployed frontend origin, use managed PostgreSQL backups, configure the verified reset-email sender and Google OAuth client if those options are offered, configure secure refresh-token rotation or short-lived sessions, add audit logging and request monitoring, and test authorization against every protected endpoint.

## Manual bank transfer payments

Configure `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NAME`, `PAYMENT_ACCOUNT_NUMBER`, and `PAYMENT_INSTRUCTIONS` in `server/.env`. The checkout displays these server-configured details and the exact order total. Customers place the order first, then submit a transaction reference and optionally a JPG, PNG, WebP, or PDF receipt (maximum 5 MB) from the order details page. Payment submissions and receipt bytes are stored privately in PostgreSQL and are available only to the order owner and authorized administrators.

Manual bank-transfer submissions remain pending until an administrator checks the bank account and approves them. A receipt or transaction reference alone never marks an order paid. Rejections require a reason and allow corrected payment information to be submitted again. Administrator decisions are retained in payment verification history.

API endpoints: `GET /api/payments/instructions`, `POST /api/payments/orders/:orderId/receipt`, `GET /api/payments/orders/:orderId/receipt` (owner-only), customer-owned order details at `/api/orders/mine/:id`, `GET /api/payments/admin/pending`, `GET /api/payments/admin/:paymentId/receipt`, `GET /api/payments/admin/review-history`, and `PATCH /api/payments/admin/:paymentId/review`. Historical Payo payment records remain read-only in the administrator dashboard at `/api/payments/admin/legacy-payo`; no new Payo payments can be started. Receipt requests use JSON with a base64-encoded optional file.

Order messages are stored in PostgreSQL and can be read or sent at `/api/orders/:id/messages` by the order's customer, assigned delivery person, and store staff. They are intentionally request/refresh based; no separate chat service is used.

The bank-transfer workflow does not itself make the store a licensed payment service provider; it is a customer-to-store transfer flow. Whether the store may trade, use a particular personal/business account, or onboard with a bank/payment provider without a business license depends on applicable Ethiopian commercial, tax, bank, and provider requirements. Confirm those requirements with the bank and relevant authorities before accepting public payments.
