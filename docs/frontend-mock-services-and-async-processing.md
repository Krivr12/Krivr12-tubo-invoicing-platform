# Frontend, Mock Government Service and Asynchronous Processing

This document covers the React frontend, the mocked government API, and how invoices are processed in the background. It answers questions H1 to H3 from [technical-assessment.md](./technical-assessment.md).

Each point is marked **Built** (in the code) or **Planned** (a gap, with the fix).

---

## 1. Frontend setup

### Stack and how to run it

| Item | Choice |
|---|---|
| Framework | React 18 with Vite, TypeScript |
| Styling | Tailwind, loaded from the CDN script in `index.html` |
| State | React `useState` in `App.tsx` |
| Navigation | A `view` state (`DASHBOARD`, `CREATE`, `DETAILS`), no router library |
| API calls | One `fetch` wrapper in `src/api.ts` |
| Token storage | `localStorage` (`tubo_token`, `tubo_user`) |

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev              # http://localhost:5173
```

The database must be up (`docker compose up -d postgres`), the API must be running on port 4000, and **the worker must be running** (`npm run worker` in `backend/`). Without the worker, new invoices stay `PENDING`.

### Screens

| Screen | File | What it does |
|---|---|---|
| Login | `features/auth/login-page.tsx` | Email and password. Has buttons to fill the two demo accounts. |
| Dashboard | `features/invoices/invoice-dashboard.tsx` | Table with invoice number, customer, date, amount and status. Filter by status. |
| Create invoice | `features/invoices/create-invoice-page.tsx` | Header fields, add and remove line items, per-line total calculated as you type. Server validation errors show above the form. |
| Invoice details | `features/invoices/invoice-details-page.tsx` | Header, items, status and processing logs. Shows a **Retry** button for failed invoices. |
| Status badge | `components/status-badge.tsx` | Shared colored label for the four statuses. |

The page code is organized by feature, as the project structure asks. `App.tsx` keeps all the state and passes it down as props, which is fine for a small app.

### Frontend gaps

| Gap | Effect |
|---|---|
| No automatic refresh | The worker changes statuses in the background, but the dashboard only refreshes when you navigate or change the filter. A new invoice shows `PENDING` until you reload. |
| No `401` handling | When the token expires, calls fail with an error message instead of sending the user to the login page. |
| Retry shows stale data | After Retry, the details page shows `PENDING` and does not update again when the worker finishes. |
| Retry button shows for every `FAILED` invoice | The server rejects a permanent failure with `409`, but the button should be hidden for those. |
| Demo credentials prefilled | `userA@alpha.com` and `password123` are the default login state. Remove before any real deployment. |
| Tailwind from CDN | Works for development but is not meant for production. |
| Token in `localStorage` | Readable by any script on the page. An `httpOnly` cookie is safer. |

---

## 2. The mock government service

Assessment Part G says Tubo sends every invoice to `POST /government-api/invoices`. That service doesn't exist, so a function stands in for it.

**Where it is:** `mockGovernmentApi()` in `backend/src/modules/invoices/processor.ts`. It is a function in the worker process, not an HTTP server.

**What it does:** waits 2 to 3.5 seconds to imitate network time, then picks a random result.

| Chance | Result | Meaning |
|---|---|---|
| 50% | `200` | Accepted |
| 25% | `503` | Service temporarily unavailable |
| 15% | `400` | Invoice rejected as invalid |
| 10% | No reply | Never answers, so the timeout fires |

The timeout is real. `submitToGovernment()` races the call against `GOVERNMENT_API_TIMEOUT_MS` (10 seconds by default). If nothing answers in time, the attempt is recorded as a timeout.

**How each result is treated**

| Result | Invoice becomes | Failure type | What happens next |
|---|---|---|---|
| `200` | `SUBMITTED` | none | Done |
| `503` | `FAILED` | `RETRYABLE` | Retried automatically with backoff |
| Timeout | `FAILED` | `RETRYABLE` | Retried automatically. The outcome is unknown, so the idempotency key matters here. |
| `400` | `FAILED` | `PERMANENT` | Never retried. Manual retry returns `409`. |
| Anything else | `FAILED` | `RETRYABLE` | Treated as temporary |

**Status**

| Item | Status |
|---|---|
| Random 200 / 503 / 400 / no reply results | Built |
| Real request timeout | Built |
| `RETRYABLE` and `PERMANENT` failure types | Built |
| Invoice ID passed to the submission call as the idempotency key | Built |
| The mock remembers keys and returns the same result for a repeat | **Not built.** The mock accepts the key and ignores it. |
| Real HTTP call using `GOVERNMENT_API_BASE_URL`, with the key sent as an `Idempotency-Key` header | Planned. The URL is not in the config yet. |

The last two rows matter. The key is passed along, but nothing on the receiving end honors it yet. The protection is only real once a government service that supports the key sits behind the call.

---

## 3. Asynchronous processing

```
Client → API → PostgreSQL (the invoices table is the queue) ← Worker process → Government API
```

No message broker is used. The `invoices` table is the queue.

1. `POST /api/invoices` validates the request, saves the invoice and its items as `PENDING` with `nextRetryAt = now`, and returns **`202 Accepted`**. It never calls the government.
2. The **worker** is a separate Node process (`npm run worker`). If it stops, the API keeps running, and the invoices wait.
3. The worker polls for due invoices and claims a small batch in one transaction using `SELECT ... FOR UPDATE SKIP LOCKED`. Each claimed invoice becomes `PROCESSING`, gets its `attemptCount` increased, and gets a `lockedUntil` time (60 seconds by default).
4. For each claim, one attempt row is opened in `processing_logs`. The worker calls the government, then saves the result on the invoice and closes the attempt row.
5. The result is saved only if the attempt still owns the invoice (`PROCESSING` and the same attempt number). A late result from a worker whose lock expired is discarded.

---

## Question H1

**How would you implement this asynchronously?**

> The API only stores the invoice and answers `202`. A separate worker process claims due invoices from the database, using row locks so two workers never take the same one, then calls the government and records every attempt.

**Why the table and not RabbitMQ or SQS:** the invoice row and its status are already the source of truth. A separate queue would add a second place where state could disagree, and a crash between "save invoice" and "queue message" could lose an invoice. With the table, saving the invoice is queuing it. At much higher volume a real queue becomes worth it (assessment Part K).

**Status:** Built. The worker, the claim query, the lock, the attempt rows and the `202` response are all in the code.

---

## Question H2

**What is the difference between accepting an invoice and successfully submitting it?**

> Accepting means Tubo checked the invoice and saved it safely, and promises to deliver it. Submitting means the government confirmed it received the invoice.

| | Accepted | Submitted |
|---|---|---|
| Who decides | Tubo | The government service |
| When | During the API request | Later, in the worker |
| Status after | `PENDING` | `SUBMITTED` |
| Signal | `202 Accepted` | Not in the response. The client sees it by reading the invoice status. |

A `202` says "your invoice is safe with us", not "the government has it". `SUBMITTED` is the only status that means the government confirmed it. This is why the frontend needs to refresh status on its own, which it doesn't do yet.

---

## Question H3

**What happens if the external API remains unavailable for 30 minutes?**

> Each invoice is retried automatically with growing delays, so most invoices recover once the service is back, with nobody pressing anything. If the outage outlasts all the attempts, the invoice stays `FAILED` and a person can retry it by hand.

**The retry rules (built):**

- Only `RETRYABLE` failures (`503`, timeout, unexpected reply) are retried. `PERMANENT` failures (`400`) are not.
- After a failed attempt, the delay doubles each time, starting at 60 seconds and capped at 15 minutes, with a random +/-20% so invoices don't all retry in the same second.
- The default limit is 8 attempts (`MAX_RETRY_ATTEMPTS`).

| Attempt | Delay before it | Approximate time since the first try |
|---|---|---|
| 1 | none | 0 min |
| 2 | 1 min | 1 min |
| 3 | 2 min | 3 min |
| 4 | 4 min | 7 min |
| 5 | 8 min | 15 min |
| 6 | 15 min (cap) | 30 min |
| 7 | 15 min | 45 min |
| 8 | 15 min | 60 min |

For a 30 minute outage, attempt 6 lands right at the edge and may still fail. Attempt 7, at about 45 minutes, succeeds. The schedule covers about an hour in total.

**After the last attempt:** the invoice stays `FAILED` and `RETRYABLE` with no next retry time. A manual retry puts it back in the queue and grants a new full set of attempts. Attempt numbers keep counting up, so the history stays in order.

**Not built (planned):**

1. **Circuit breaker.** If many recent calls fail, workers should pause for a short while and then test with one invoice. Today every queued invoice keeps burning attempts during an outage.
2. **Shared speed limit.** When the service returns, the backlog arrives together. The batch size limits how many run per worker, but nothing caps the total requests per second across workers.

Every attempt has its own `processing_logs` row, so the full story of the outage (each `503`, each timestamp) is kept.

---

## 4. Crash after a successful submission

This is assessment Part I.

1. The worker sends the invoice, and the government accepts it.
2. The server crashes before saving `SUBMITTED`.
3. The invoice stays `PROCESSING` with a `lockedUntil` time that runs out.
4. After the lock expires, a worker claims it again. It closes the stale attempt row with the message "The worker stopped before recording a result", and opens a new attempt.
5. The invoice is submitted again with the same key, which is the invoice `id`.
6. A government service that honors the key returns the original result and creates no second copy.
7. Tubo saves `SUBMITTED`.

If the lock expired and the invoice has no attempts left, it becomes `FAILED` and `RETRYABLE` rather than staying stuck.

**What is real today:** steps 3, 4, 5 and 7 are built. Step 6 depends on the government service, and the mock doesn't implement it. If the real service ignores the key, the fallback is to ask "do you already have this invoice?" before any resend of an invoice whose outcome is unknown.

---

## 5. What is left, in order

1. **Make the mock honor the key** (remember keys, return the same result for a repeat), so deduplication can be shown working. When a real service exists, replace the mock with an HTTP call to `GOVERNMENT_API_BASE_URL` that sends the `Idempotency-Key` header.
2. **Frontend:** refresh the dashboard and details page while any invoice is `PENDING` or `PROCESSING`, send the user to login on `401`, and hide Retry for permanent failures.
3. **Circuit breaker and a shared speed limit** across workers.
4. **Tests** for crash recovery, the retry schedule and the stale result guard.
