# Frontend, Mock Government Service and Asynchronous Processing

This document covers the React frontend, the mocked government API, and how invoices are processed in the background. It answers questions H1 to H3 from [technical-assessment.md](./technical-assessment.md).

Each point is marked **Built** (in the code today) or **Planned** (a gap, with the design). The asynchronous part is the biggest difference between the two, so section 3 shows both side by side.

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
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:4000/api
npm run dev              # http://localhost:5173
```

The backend must be running on port 4000 and the database must be up (`docker compose up -d`).

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
| No automatic refresh | Invoices change status in the background, but the dashboard only refreshes when you navigate or change the filter. A new invoice stays on `PENDING` until you reload. |
| No `401` handling | When the token expires, calls fail with an error message instead of sending the user to the login page. |
| Retry shows stale data | After Retry, the details page shows the `PENDING` response and does not update again when processing finishes. |
| Demo credentials prefilled | `userA@alpha.com` and `password123` are the default login state. Remove before any real deployment. |
| Tailwind from CDN | Works for development but is not meant for production. It is not listed in the tech stack yet. |
| Token in `localStorage` | Readable by any script on the page. An `httpOnly` cookie is safer. |

---

## 2. The mock government service

Assessment Part G says Tubo sends every invoice to `POST /government-api/invoices`. That service doesn't exist, so a function stands in for it.

**Where it is:** `mockGovernmentApi()` in `backend/src/modules/invoices/processor.ts`. It is a function in the same process, not an HTTP server.

**What it does:** waits 2 to 3.5 seconds to imitate network time, then picks a random result.

| Chance | Result | Meaning |
|---|---|---|
| 50% | `200` | Accepted |
| 25% | `503` | Service temporarily unavailable |
| 15% | `400` | Invoice rejected as invalid |
| 10% | `504` | Timeout, no answer in time |

The mock doesn't hang, so a timeout is returned as a `504` result and not as a real wait. A real client needs an actual request timeout (for example 10 seconds with `AbortController`), and the worker should treat an abort as "unknown outcome". That matters for the crash scenario in section 4.

**How each result should be treated**

| Result | Type | What Tubo should do |
|---|---|---|
| `200` | Success | Mark `SUBMITTED` |
| `503` | Temporary | Mark `FAILED` with type `RETRYABLE`, retry automatically later |
| Timeout | Temporary, outcome unknown | Same as `503`, and the idempotency key protects against a double submit |
| `400` | Permanent | Mark `FAILED` with type `PERMANENT`. Never retry automatically, and don't allow manual retry. |

**Status**

| Item | Status |
|---|---|
| Random 200 / 503 / 400 / timeout results | Built |
| Real HTTP call using `GOVERNMENT_API_BASE_URL` | Planned. The URL is not in the config yet, and the mock is meant to be swapped for one HTTP call. |
| `Idempotency-Key` header with the invoice `id` | Planned |
| Separate `RETRYABLE` and `PERMANENT` failure types | Planned. Today every failure is just `FAILED`. |

---

## 3. Asynchronous processing

### What the code does today

```
POST /api/invoices
  → validate → save as PENDING → return 201
  → void processInvoiceAsync(id)     (runs inside the API process, not awaited)
        PROCESSING → call mock → SUBMITTED or FAILED
```

The request does not wait for the government call, so the response is fast. That part works as intended. But the background job is a plain function call inside the API server, and that causes real problems:

| Problem | What happens |
|---|---|
| Server crashes or restarts mid-job | The invoice stays `PROCESSING` forever. Nothing picks it up again. |
| Two jobs for the same invoice | Nothing locks the invoice, so a retry click during processing could submit twice. |
| Temporary failure | The invoice becomes `FAILED` on the first `503`. There is no automatic retry or backoff. |
| Permanent failure | A `400` invoice can be manually retried, even though it will never succeed. |
| Heavy load | Every invoice starts a job at once. There is no limit on concurrent calls to the government API. |
| Attempt numbers | Counted by searching log messages that start with `[Attempt #`. This breaks if the message text changes. |
| Response code | Returns `201 Created`. The rule for this project is `202 Accepted`. |

### Target design

This is the design the project rules describe. It needs a schema migration (`failureType`, `attemptCount`, `nextRetryAt`, `lockedUntil`) and a separate worker script.

```
Client → API → PostgreSQL (invoices table = the queue) ← Worker process → Government API
```

No message broker is added. The `invoices` table is the queue.

---

## Question H1

**How would you implement this asynchronously?**

1. **The API only stores.** `POST /api/invoices` validates the request, saves the invoice and its items as `PENDING` in one transaction, and returns `202 Accepted` with the invoice ID. It never calls the government service.

2. **A worker runs as its own Node process**, started with its own npm script in `backend/`. If the worker crashes, the API keeps running, and the other way around.

3. **The worker claims due invoices in a loop.** The claim happens inside a transaction using Postgres row locks:

```sql
SELECT id FROM invoices
WHERE (status = 'PENDING' AND "nextRetryAt" <= now())
   OR (status = 'PROCESSING' AND "lockedUntil" < now())
ORDER BY "nextRetryAt"
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

   `SKIP LOCKED` means two workers never take the same row. Each claimed row is set to `PROCESSING` with `lockedUntil = now() + 2 minutes`.

4. **For each claimed invoice** the worker writes a `processing_logs` row for the attempt, calls the government service with `Idempotency-Key: <invoice id>`, then updates the invoice (`SUBMITTED`, or `FAILED` with a failure type and next retry time) and closes the log row.

5. **Crash recovery is built in.** If a worker dies, `lockedUntil` runs out and another pass reclaims the invoice.

Why the table and not RabbitMQ or SQS: the invoice row and its status are already the source of truth. A separate queue would add a second place where the state can disagree, and a crash between "save invoice" and "enqueue message" could lose an invoice. With the table, saving the invoice is enqueuing it. At much higher volume a real queue becomes worth it (see assessment Part K).

---

## Question H2

**What is the difference between accepting an invoice and successfully submitting it?**

They are two separate events with different owners.

| | Accepted | Submitted |
|---|---|---|
| Who decides | Tubo | The government service |
| What it means | Tubo checked the invoice, stored it safely and promises to deliver it | The government confirmed it received the invoice |
| When | During the API request | Later, in the worker |
| Status after | `PENDING` | `SUBMITTED` |
| HTTP signal | `202 Accepted` | Not in the response. The client sees it by reading the invoice status. |

A `202` tells the client "your invoice is safe with us", not "the government has it". Showing `PENDING` or `PROCESSING` in the UI is correct and honest, and `SUBMITTED` is the only status that means the government confirmed it. This is also why the frontend needs to refresh status on its own, which it doesn't do yet.

---

## Question H3

**What happens if the external API is unavailable for 30 minutes? What retry strategy?**

**Today:** each invoice gets one try, fails with `503` and becomes `FAILED`. A person has to click Retry on each one. After a 30 minute outage, every invoice that arrived during it would be stuck.

**Target strategy:** retry automatically with exponential backoff, and stop after a fixed number of attempts.

- Only `RETRYABLE` failures (`503`, timeout) are retried. `PERMANENT` failures (`400`) are not.
- After each failed attempt the worker sets `nextRetryAt = now + delay` and puts the invoice back to `PENDING`.
- The delay doubles each time, starting at 30 seconds and capped at 10 minutes, with a little random jitter so many invoices don't retry at the same second.
- The attempt limit is 10.

| Attempt | Delay before it | Time since first try |
|---|---|---|
| 1 | none | 0 min |
| 2 | 30 s | 0.5 min |
| 3 | 1 min | 1.5 min |
| 4 | 2 min | 3.5 min |
| 5 | 4 min | 7.5 min |
| 6 | 8 min | 15.5 min |
| 7 | 10 min (cap) | 25.5 min |
| 8 | 10 min | 35.5 min |
| 9 | 10 min | 45.5 min |
| 10 | 10 min | 55.5 min |

For a 30 minute outage, attempt 7 (25.5 min) still fails and attempt 8 (35.5 min) succeeds. The schedule covers about an hour in total, so the invoice recovers without anyone touching it.

**If the outage lasts longer than that:** after attempt 10 the invoice stays `FAILED` with `RETRYABLE`, and the manual Retry button becomes available. Manual retry resets the attempt counter.

**Two protections for the outage itself**

1. **Circuit breaker.** If the last several calls all returned `503` or timed out, the worker pauses all submissions for a short period, then tries one invoice as a probe. Without it, every queued invoice burns attempts against a service that is known to be down.
2. **Rate limit on the worker.** When the service comes back, the backlog arrives at once. The worker caps concurrency so it doesn't flood the recovering service (see assessment Part K).

Each attempt has its own `processing_logs` row, so the full story of the 30 minutes (every `503`, every timestamp) is kept and nothing is overwritten.

---

## 4. Crash after a successful submission (why the idempotency key matters)

This is assessment Part I, and it depends on everything above.

1. The worker sends the invoice, and the government accepts it.
2. The server crashes before saving `SUBMITTED`.
3. After restart, the row is `PROCESSING` with an expired `lockedUntil`, so the worker claims it again.
4. The worker sends it again with the same `Idempotency-Key` (the invoice `id`).
5. The government service recognizes the key and returns the original result instead of creating a second invoice.
6. Tubo saves `SUBMITTED`.

Without the header, step 4 would create a duplicate at the government. Today the code has no key and no recovery, so a crash at step 2 leaves the invoice stuck on `PROCESSING`.

---

## 5. What to build next, in order

1. **Migration:** add `failureType`, `attemptCount`, `nextRetryAt` and `lockedUntil` to `invoices`. Give `processing_logs` real columns for attempt number, start and end time, HTTP status and result, so attempts are not read from message text.
2. **Worker process** in `backend/`, with `FOR UPDATE SKIP LOCKED` claiming and lock expiry recovery. Remove the `void processInvoiceAsync()` calls from `service.ts`.
3. **Retry rules in `processor.ts`:** exponential backoff, attempt limit, `PERMANENT` never retried. Make the retry endpoint reject non-retryable invoices with `409`.
4. **Real HTTP client** using `GOVERNMENT_API_BASE_URL`, a request timeout, and the `Idempotency-Key` header. Keep the random mock behind the same function for local use.
5. **`POST /api/invoices` returns `202`.**
6. **Frontend:** poll the dashboard and details page while any invoice is `PENDING` or `PROCESSING`, and send the user to login on `401`.
7. **Circuit breaker and worker concurrency limit.**
