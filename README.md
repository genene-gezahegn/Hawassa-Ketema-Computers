# Hawassa-Ketema Computers

A full-stack storefront and inventory-management application for a computer retailer in Hawassa, Ethiopia. The original React storefront and inventory interface are preserved; a Node.js/Express API and PostgreSQL data layer have been added.

## Architecture

- **Frontend:** React 19, TypeScript, Vite, Zustand, Tailwind CSS
- **Backend:** Node.js (ES modules), Express
- **Database:** PostgreSQL
- **Authentication:** bcrypt password hashing + signed JWT access tokens
- **Authorization:** server-side role-based access control (`admin`, `customer`, `employee`, `delivery_person`) with explicit employee delivery permissions

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

Copy `.env.example` to `.env` and set a strong `JWT_SECRET`, your PostgreSQL `DATABASE_URL`, and `CLIENT_ORIGIN`. Password recovery by email is not part of this application. Order and delivery notification emails remain optional; the API starts and order workflows continue when SMTP is not configured. To use Gmail SMTP, set `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=465`, `EMAIL_SECURE=true`, `EMAIL_USER` to your Gmail address, `EMAIL_APP_PASSWORD` to a Google App Password, and `EMAIL_FROM` to a sender using that same Gmail address. Do not use your regular Gmail password. Render Free blocks outbound SMTP ports 465 and 587, so notifications cannot be delivered from a Free web service. See [Render's free-service limitations](https://render.com/docs/free#other-limitations). To enable Google sign-in, set `GOOGLE_CLIENT_ID` to a Google OAuth client ID for a web application and add the storefront origin as an authorized JavaScript origin.

Run the schema migration:

```bash
npm run migrate
```

Create the first administrator and import your existing frontend sample catalog into PostgreSQL. Set these variables in `server/.env` before running the command:

```env
ADMIN_NAME=Store Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-unique-password-at-least-12-characters
```

```bash
npm run create-admin
npm run seed-demo
npm run dev
```

API health check: `http://localhost:4000/api/health`.

## Production deployment settings

### Render API

- Root directory: `server`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`
- Required environment variables:
  - `NODE_ENV=production`
  - `DATABASE_URL` set to the Neon PostgreSQL connection string
  - `CLIENT_ORIGIN` set to the one HTTPS Vercel storefront origin, with no path or trailing slash
  - `JWT_SECRET` set to a unique random value of at least 32 characters (never the example value)
- Set `PORT` only if needed; Render supplies it automatically. Production database connections always use TLS with certificate verification.
- Set up the database before serving traffic. Run `npm run migrate` from the `server` directory with the production `DATABASE_URL` configured. These migrations are additive/idempotent and do not drop application data. Do not run `seed-demo` against production unless intentionally importing sample products.
- Optional configuration includes `GOOGLE_CLIENT_ID`, payment account variables, and SMTP settings (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM`). For Gmail, use `smtp.gmail.com`, port `465`, secure mode `true`, and a Google App Password. SMTP notifications remain disabled if the required SMTP credentials are absent; no Resend credentials or custom sending domain are required.

Generate a JWT secret locally with Node.js, then copy its output directly into Render's environment settings:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Vercel storefront

- Framework preset: Vite
- Root directory: repository root
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` at build time to the HTTPS Render API base URL ending in `/api` (for example, `https://your-api.onrender.com/api`). Production builds fail if it is missing or not HTTPS.

## 3. Start the frontend

In a second terminal, from the project root:

```bash
npm install
```

Copy root `.env.example` to `.env` and set `VITE_API_URL=http://localhost:4000/api` if your API runs elsewhere.

```bash
npm run dev
```

Open `http://localhost:5173`.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register customer |
| POST | `/api/auth/login` | Public | Sign in |
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
npm run build
```

Run the API test suite separately from the `server` directory with `npm test`.

The API has its own `server/package.json` and is started separately from Vite. Run `npm run seed-demo` again whenever you want to refresh the database from the bundled sample catalog; existing products are matched by SKU. Existing password-reset database columns and migrations are retained unchanged; they are unused by the application.

SMTP settings are optional and used only for best-effort order/delivery notifications on hosts that permit SMTP. The backend does not require SMTP configuration to start. Render Free web services block outbound SMTP ports 465 and 587, so email notifications are unavailable there; ordering, delivery, and payment workflows are unaffected.

## Production checklist

Before a public launch: use HTTPS, set a strong unique JWT secret, restrict CORS to the deployed frontend origin, use managed PostgreSQL backups, configure the Google OAuth client if that option is offered, configure secure refresh-token rotation or short-lived sessions, add audit logging and request monitoring, and test authorization against every protected endpoint.

## Manual bank transfer payments

Configure `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NAME`, `PAYMENT_ACCOUNT_NUMBER`, and `PAYMENT_INSTRUCTIONS` in `server/.env`. The checkout displays these server-configured details and the exact order total. Customers place the order first, then submit a transaction reference and optionally a JPG, PNG, WebP, or PDF receipt (maximum 5 MB) from the order details page. Payment submissions and receipt bytes are stored privately in PostgreSQL and are available only to the order owner and authorized administrators.

Manual bank-transfer submissions remain pending until an administrator checks the bank account and approves them. A receipt or transaction reference alone never marks an order paid. Rejections require a reason and allow corrected payment information to be submitted again. Administrator decisions are retained in payment verification history.

API endpoints: `GET /api/payments/instructions`, `POST /api/payments/orders/:orderId/receipt`, `GET /api/payments/orders/:orderId/receipt` (owner-only), customer-owned order details at `/api/orders/mine/:id`, `GET /api/payments/admin/pending`, `GET /api/payments/admin/:paymentId/receipt`, `GET /api/payments/admin/review-history`, and `PATCH /api/payments/admin/:paymentId/review`. Historical Payo payment records remain read-only in the administrator dashboard at `/api/payments/admin/legacy-payo`; no new Payo payments can be started. Receipt requests use JSON with a base64-encoded optional file.

Order messages are stored in PostgreSQL and can be read or sent at `/api/orders/:id/messages` by the order's customer, assigned delivery person, and store staff. They are intentionally request/refresh based; no separate chat service is used.

The bank-transfer workflow does not itself make the store a licensed payment service provider; it is a customer-to-store transfer flow. Whether the store may trade, use a particular personal/business account, or onboard with a bank/payment provider without a business license depends on applicable Ethiopian commercial, tax, bank, and provider requirements. Confirm those requirements with the bank and relevant authorities before accepting public payments.
