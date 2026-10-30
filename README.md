# Tubo Electronic Invoicing Engine (Parts A–E)

This project contains the backend API, data layer, multi-tenant isolation, and database architecture for the Tubo electronic invoicing platform.

---

## 1. Quick Start Guide

### Step 1: Start PostgreSQL via Docker
From the project root:
```bash
docker compose up -d
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 3: Run Database Migrations and Seed
```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

Seeding creates two companies with credentials:
* **Company A User**: `userA@alpha.com` | `password123`
* **Company B User**: `userB@beta.com` | `password123`

### Step 4: Run the API Server
```bash
npm run dev
```
The server will boot on `http://localhost:4000`.

---

## 2. API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Login and receive JWT | No |
| `POST` | `/api/invoices` | Create invoice with line items | Yes (Bearer Token) |
| `GET` | `/api/invoices` | List invoices (status, pagination) | Yes (Bearer Token) |
| `GET` | `/api/invoices/:id` | Get invoice details and logs | Yes (Bearer Token) |
| `POST` | `/api/invoices/:id/retry` | Retry failed invoice submission | Yes (Bearer Token) |

---

## 3. Assessment Technical Questions Answered

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