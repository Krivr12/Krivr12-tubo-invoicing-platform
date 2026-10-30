# Backend API and Authentication Security

This document covers how the Tubo backend API is put together, how users log in, and how one company's data is kept away from another's. It answers questions E1 to E3 from [technical-assessment.md](./technical-assessment.md).

Each point is marked **Built** (in the code today) or **Planned** (a gap, with the fix). Nothing here is claimed unless it is in the code.

---

## 1. The API in short

The backend is Node.js, Express and TypeScript. Prisma talks to PostgreSQL. Zod validates input.

| Method | Path | What it does | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Checks email and password, returns a JWT | No |
| `POST` | `/api/invoices` | Validates and stores an invoice as `PENDING` | Bearer token |
| `GET` | `/api/invoices` | Lists the company's invoices (status, number, date, pagination) | Bearer token |
| `GET` | `/api/invoices/:id` | Returns one invoice with its items and processing logs | Bearer token |
| `POST` | `/api/invoices/:id/retry` | Moves a `FAILED` invoice back to `PENDING` | Bearer token |

Every request follows the same path, and each layer has one job:

```
routes → controller → service → Prisma
```

- **routes.ts** attaches the `authenticate` middleware to every invoice route.
- **controller.ts** reads the token's `companyId` and validates the request with Zod.
- **service.ts** holds the business logic and is the only layer that touches the database.
- **errorHandler.ts** turns Zod errors into `400` and duplicate invoice numbers into `409`. Everything else becomes a generic `500`.

---

## 2. How login works

1. The user sends an email and password to `/api/auth/login`.
2. The server finds the user and compares the password with the stored bcrypt hash.
3. If it matches, the server signs a JWT with `JWT_SECRET`. The token carries `userId`, `companyId` and `email`, and expires after `JWT_EXPIRES_IN` (1 day by default).
4. The frontend sends the token as `Authorization: Bearer <token>` on every call.
5. The `authenticate` middleware verifies the signature and expiry. A missing or bad token gets `401`.

Passwords are only stored as bcrypt hashes. A wrong email and a wrong password return the same message, `Invalid email or password`.

---

## Question E1

**How will you guarantee that User A cannot access Company B's invoices by manually changing an invoice ID in the URL?**

The server never trusts the client to say which company it belongs to. The company comes from the signed token, and every query uses it.

1. At login, `companyId` is written into the JWT. A user can't edit it without breaking the signature.
2. The controller reads `req.user.companyId` from the verified token. It ignores the body, URL and query string for this.
3. The service always queries with both values:

```typescript
prisma.invoice.findFirst({
  where: { id: invoiceId, companyId },
});
```

If User A types one of Company B's invoice IDs, the query finds no row, and the API returns `404 Not Found`. It returns 404 and not 403 so the response doesn't confirm that the ID exists.

The same rule applies to the other endpoints:

- **List:** `where` always includes `companyId`, so the list only has the caller's invoices.
- **Retry:** loads the invoice with `{ id, companyId }` first, so another company's invoice returns 404 before anything changes.
- **Create:** `companyId` is set from the token. The request body cannot carry one.

**Status**

| Item | Status |
|---|---|
| `companyId` taken only from the verified token | Built |
| Every invoice query scoped by `companyId` | Built |
| 404 for another company's invoice | Built |
| Manual check in Bruno (requests 8 and 9) | Built |
| Automated tenant isolation tests | Planned |

One limit to know about: the token is trusted until it expires. If a user is removed or moved to another company, their old token still works for up to a day. A short token lifetime plus a refresh token, or a token version check on each request, would close that.

---

## Question E2

**Where should database passwords, JWT secrets and external API credentials be stored? What should not be committed to Git?**

All three are secrets. They live in environment variables, not in code.

| Secret | Local development | Production |
|---|---|---|
| Database password (inside `DATABASE_URL`) | `backend/.env` | Secret manager, injected at runtime |
| `JWT_SECRET` | `backend/.env` | Secret manager, injected at runtime |
| External API credentials | `backend/.env` | Secret manager, injected at runtime |

Rules that go with this:

- **Never commit:** `.env` and any `.env.*` file, private keys (`*.pem`, `*.key`), database dumps, and real tokens or passwords in code, tests, Bruno files or logs.
- **Commit only** `.env.example`, with placeholder values.
- **Keep secrets out of the frontend.** Anything named `VITE_*` is bundled into the browser, so it is public. The government credentials belong only on the backend.
- **Use different values per environment**, and a `JWT_SECRET` that is long and random (for example `openssl rand -base64 48`).
- **If a secret reaches Git, rotate it.** Deleting it from history is not enough, because someone may already have copied it.

**Status**

| Item | Status |
|---|---|
| `.gitignore` covers `.env`, `.env.*`, `*.pem`, `*.key`, dumps; keeps `.env.example` | Built |
| `.env.example` holds placeholders only | Built |
| `docker-compose.yml` holds a Postgres password | Built, acceptable for the local container only. Use different credentials anywhere shared. |
| `JWT_SECRET` has no fallback; the process exits if it is missing or under 32 characters | Built |
| Env vars (`PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`) validated with Zod at startup | Built |
| Government API credentials | Not needed yet, the government call is a mock |

`backend/src/config/env.ts` used to fall back to a hard-coded secret when `JWT_SECRET` was unset. Anyone could read that value in the source and forge a token for any `companyId`, which would defeat E1. It now parses the environment with Zod at startup. If a variable is missing or invalid, the process prints the variable name and reason (never the value) and exits with code 1.

---

## Question E3

**What security checks would you implement before accepting an invoice API request?**

The checks run in this order. The cheap ones run first, so bad requests are rejected before touching the database.

| # | Check | Why | Status |
|---|---|---|---|
| 1 | HTTPS | Tokens and invoice data must not travel in plain text | Planned (done at the proxy or load balancer in production) |
| 2 | Rate limit | Slows brute force and flooding. Today: 100 requests per 15 minutes per IP | Built (global only) |
| 3 | Body size limit | Stops huge payloads | Planned (`express.json()` has no explicit limit) |
| 4 | CORS allowlist | Only the frontend origin may call the API from a browser | Planned (`cors()` currently allows any origin) |
| 5 | Security headers (`helmet`) | Safe default headers | Planned (not installed) |
| 6 | Token check | Valid signature, not expired, `Bearer` format | Built |
| 7 | Pin the JWT algorithm | Only accept `HS256`, so a token with a different algorithm is refused | Planned (`jwt.verify` has no `algorithms` option) |
| 8 | Schema validation (Zod) | Types, required fields, valid email, 3-letter currency, at least one item, positive integer quantity, no negative amounts | Built |
| 9 | Math validation | `lineTotal` must equal `quantity × unitPrice + tax` | Built |
| 10 | Server-side totals | The server calculates subtotal, tax and total from the items. The client never sends them, so they can't be tampered with | Built |
| 11 | Tenant scoping | `companyId` comes from the token, never from the request | Built |
| 12 | Duplicate check | Database unique key on `(companyId, invoiceNumber)`, returns `409` | Built |
| 13 | Length limits | Maximum string lengths and maximum number of items per invoice | Planned |
| 14 | Safe errors | No stack traces, SQL or database details sent to the client | Built (generic 500) |

Two more items I would add for write endpoints: a tighter rate limit on `/api/auth/login` and `POST /api/invoices` than the global one, and a request ID on every response so a support engineer can trace one request through the logs.

---

## 3. Known gaps, in the order I would fix them

1. ~~Remove the `JWT_SECRET` fallback and validate env vars with Zod at startup.~~ Done.
2. **Add tests for tenant isolation** (User B asking for User A's invoice returns 404). Right now this is only checked by hand in Bruno.
3. **Replace `cors()`** with an allowlist from config, add `helmet`, set a body size limit, and pin the JWT algorithm.
4. **Add a stricter rate limit** on login and invoice creation.
5. **Use one error shape** (`{ error: { code, message, details } }`) with stable codes. The API currently returns plain `{ message }` bodies, and the retry guard returns `400` where the project rules say `409`.
6. **Make login timing equal** for unknown email and wrong password. Today an unknown email returns before the bcrypt check, so response time can reveal which emails exist.
7. **Calculate money with `Decimal`**, not JavaScript numbers. `service.ts` sums with floating point and rounds with `toFixed(2)`, which can drift on large invoices.
8. **Decide roles and onboarding.** Admin and member permissions, and how a company's first user is created, are not decided yet. This document makes no assumption about either.
