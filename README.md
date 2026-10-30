# Tubo Electronic Invoicing Engine (Parts A–E)

This project contains the backend API, data layer, multi-tenant isolation, and database architecture for the Tubo electronic invoicing platform.

---

## 1. Quick Start Guide

Tubo runs as **four pieces**: PostgreSQL (Docker), the API, the worker, and the frontend. The worker is a separate Node process. Without it, new invoices are accepted and stored but stay `PENDING`, because nothing submits them.

Requirements: Node.js 20+, npm, Docker.

### Step 1: Start PostgreSQL
From the project root:
```bash
docker compose up -d postgres
```
PostgreSQL listens on `localhost:5433`.

### Step 2: Configure and install the backend
```bash
cd backend
cp .env.example .env     # then edit .env, see below
npm install
```
In `backend/.env`:
* `DATABASE_URL` uses the credentials in `docker-compose.yml`: `postgresql://tubo_user:tubo_password@localhost:5433/tubo_db`
* `JWT_SECRET` must be at least 32 characters. Generate one with `openssl rand -base64 48`.
* The worker and retry settings are optional. The defaults are in `.env.example`.

### Step 3: Apply migrations and seed
```bash
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed
```
`migrate deploy` applies the committed migrations without prompting or resetting data. Use `npx prisma migrate dev` only when you change `schema.prisma`.

> **Warning:** `npm run prisma:seed` deletes all companies, users, invoices, and logs before it creates the demo data. Do not run it on data you want to keep.

Seeding creates two companies with credentials:
* **Company A User**: `userA@alpha.com` | `password123`
* **Company B User**: `userB@beta.com` | `password123`

### Step 4: Run the API and the worker (two terminals)
```bash
# Terminal 1, in backend/
npm run dev          # API on http://localhost:4000

# Terminal 2, in backend/
npm run worker       # background worker
```
The worker and the API are independent. Stopping or crashing the worker does not stop the API, and invoices wait in `PENDING` until a worker runs again. Several workers can run at once, because each claims different rows.

### Step 5: Run the frontend (third terminal)
```bash
cd frontend
cp .env.example .env     # VITE_API_URL defaults to http://localhost:4000/api
npm install
npm run dev              # Vite prints the address, usually http://localhost:5173
```

### Production-style run
```bash
cd backend
npm run build
npm start                # API:    node dist/app.js
npm run start:worker     # Worker: node dist/worker.js
```

### Troubleshooting
* **Invoices stay `PENDING`:** the worker is not running. Start `npm run worker`.
* **`Invalid environment configuration` on start:** read the variable names printed. `JWT_SECRET` and `DATABASE_URL` are required. Also, `WORKER_LOCK_SECONDS` must be longer than `GOVERNMENT_API_TIMEOUT_MS`.
* **Prisma client errors after pulling changes:** run `npx prisma migrate deploy` and `npx prisma generate` in `backend/`, then restart the API and the worker.

---

## 2. API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Login and receive JWT | No |
| `POST` | `/api/invoices` | Create invoice with line items. Returns `202 Accepted` with status `PENDING` | Yes (Bearer Token) |
| `GET` | `/api/invoices` | List invoices (status, pagination) | Yes (Bearer Token) |
| `GET` | `/api/invoices/:id` | Get invoice details and per-attempt logs | Yes (Bearer Token) |
| `POST` | `/api/invoices/:id/retry` | Manual retry. `409 RETRY_NOT_ALLOWED` unless the invoice is `FAILED` with a `RETRYABLE` failure | Yes (Bearer Token) |

---

## 3. Invoice Processing and Retries

`POST /api/invoices` only validates and stores the invoice (`PENDING`, due immediately). The worker does the government submission, so the request never waits for it.

**Queue.** The `invoices` table is the queue. The worker claims due rows with `SELECT ... FOR UPDATE SKIP LOCKED`, sets `status = PROCESSING`, increments `attemptCount`, and sets a `lockedUntil` lease. Due rows are:
* `PENDING`
* `FAILED` with `failureType = RETRYABLE` and `nextRetryAt` reached
* `PROCESSING` with an expired `lockedUntil` (a crashed worker)

**Result handling.** The government service is a local mock in `backend/src/modules/invoices/processor.ts`. It returns a random result, so an invoice can fail several times in a row.

| Government result | Invoice | `failureType` | Next step |
| :--- | :--- | :--- | :--- |
| `200` | `SUBMITTED` | none | done |
| `503` | `FAILED` | `RETRYABLE` | automatic retry with backoff |
| timeout (no response) | `FAILED` | `RETRYABLE` | automatic retry with backoff |
| `400` | `FAILED` | `PERMANENT` | never retried, manual retry rejected |

**Backoff.** `nextRetryAt = now + min(60s x 2^(attempt-1), 15 min)` with +/-20% jitter. After `MAX_RETRY_ATTEMPTS` (default 8) the invoice stays `FAILED` and `RETRYABLE` with no `nextRetryAt`. Only a manual retry queues it again, and that grants another full set of attempts. Attempt numbers keep counting up.

**Attempt history.** Every attempt is its own row in `processing_logs`, with `attemptNumber`, `startedAt`, `endedAt`, `httpStatus`, `errorMessage`, and `processingStatus`. Earlier attempts are never overwritten. A unique key on `(invoiceId, attemptNumber)` prevents duplicate attempt rows.

**Crash safety.** If the worker dies mid-attempt, the invoice stays `PROCESSING` and its lease expires. The next claim reopens it, closes the stale attempt row, and resubmits. Every submission carries the invoice `id` as the idempotency key, so a real government service can recognize the repeat. If the lease expired and no attempts are left, the invoice becomes `FAILED` (`RETRYABLE`) instead of staying stuck.

**Tuning.** Settings are in `backend/.env` (see `.env.example`): `MAX_RETRY_ATTEMPTS`, `RETRY_BASE_DELAY_SECONDS`, `RETRY_MAX_DELAY_SECONDS`, `WORKER_BATCH_SIZE`, `WORKER_POLL_INTERVAL_MS`, `WORKER_LOCK_SECONDS`, `GOVERNMENT_API_TIMEOUT_MS`. For a quick demo of retries, set `RETRY_BASE_DELAY_SECONDS=2` and `RETRY_MAX_DELAY_SECONDS=10` in `.env` and restart the worker.

**Known limitations.**
* The mock does not remember idempotency keys. It exists to exercise the retry paths, not to prove deduplication. A real service must honor the `Idempotency-Key` header.
* The frontend does not poll. Reopen the invoice or refresh the dashboard to see new statuses.
* Rows created before this feature were backfilled: old `FAILED` rows allow manual retry but are not retried automatically.

---

## 4. Assessment Technical Questions Answered

### Question C1: Why design the database this way?
1. **Relational Integrity**: Invoices and invoice items have a strict parent-child one-to-many relationship with total cascading integrity.
2. **Precision**: Currency, unit prices, and taxes use fixed-point `Decimal(12, 2)` types rather than floating points to eliminate IEEE 754 precision issues in financial calculations.
3. **Audit Trail**: The `processing_logs` table decouples execution history from current operational state, maintaining an immutable append-only record of invoice submission lifecycles.
4. **Performance**: Composite indexes on `(company_id, status)` and `(company_id, invoice_date)` support fast pagination and dashboard filtering without full table scans.

### Question C2: How will your database prevent creating the same invoice twice?
By enforcing a composite unique constraint across the issuing company identifier and the invoice number:
```prisma
@@unique([companyId, invoiceNumber])
```
This forces the database engine to maintain a unique B-tree index, rejecting any secondary insertion attempt for an existing invoice number within the same tenant.

### Question C3: Two identical requests arrive at the same time—how do you guarantee only one is created?
Application-level checks (such as `SELECT ... WHERE invoiceNumber = X`) fail in high-concurrency environments due to race conditions (read-check-then-act gaps). 
By having the PostgreSQL composite constraint `UNIQUE(company_id, invoice_number)`, the database enforces an atomic page-level lock during row insertion. One transaction writes successfully while the second triggers a unique constraint violation error (`P2002`). Our custom `errorHandler` intercepts this and safely translates it into an `HTTP 409 Conflict`.

### Question E1: How do you prevent User A from accessing Company B's invoices by altering the URL ID?
1. **Cryptographic Identity**: When a user authenticates, their tenant context (`companyId`) is signed into their JWT.
2. **Strict Scoping**: The application never relies on client-supplied parameters for tenant checks. All database lookup operations enforce:
   ```typescript
   where: { id: req.params.id, companyId: req.user.companyId }
   ```
If User A requests an invoice ID belonging to Company B, the query matches zero rows and returns `HTTP 404 Not Found`, completely preventing Horizontal Privilege Escalation (IDOR).

### Question E2: Storage of Secrets and Git Practices
* **Database passwords, JWT secrets, and API credentials**: Must never be committed to Git. They must be stored in secret management engines (e.g., AWS Secrets Manager, HashiCorp Vault, or cloud environment variables) and injected at runtime.
* **Local development**: Kept inside `.env` files that are strictly matched by `.gitignore`. Only a sanitized `.env.example` file is tracked in version control.

### Question E3: Security checks implemented before accepting an invoice
1. **Transport Security**: Require HTTPS/TLS termination.
2. **Authentication**: Cryptographic verification of JWT signature and expiration.
3. **Rate Limiting**: IP-based rate limiting via `express-rate-limit` to deter brute-force or DoS flooding.
4. **Input Sanitization & Schema Validation**: Strict input validation using Zod to verify data types, reject unexpected keys, enforce string constraints, and independently recalculate math (`lineTotal = quantity * unitPrice + tax`) to prevent data tampering.