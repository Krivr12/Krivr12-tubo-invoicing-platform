# Failures, Scaling and Debugging: Answers to Parts I to N

This document answers every question in Parts I to N of [technical-assessment.md](./technical-assessment.md). The answers are written in plain words.

Some of this is not built yet. Where that is the case, the answer explains how I would handle it, and a short **Today** note says what the code does now.

**How to read this document:** the highlighted block under each question is the answer. The text around it adds detail.

| Part | Topic |
|---|---|
| I | The server crashes after the government accepts an invoice |
| J | Two requests for the same invoice at the same time |
| K | Growing from 10,000 to 1,000,000 invoices a day |
| L | Recording every failed attempt |
| M | Changing the API without breaking customers |
| N | Invoices are slow but the servers look fine |

---

## Part I: The critical failure

The story: the government accepts `INV-10001`, then the Tubo server crashes before it can write "submitted" in its own records. When the server restarts, Tubo thinks the invoice was never sent.

The key point is that **Tubo cannot know whether the government received the invoice.** It only knows its own records. So after a crash, the safe plan is to send again in a way that cannot create a second copy.

### I1. What should happen next?

> **Answer:** When the server restarts, the worker finds the invoice still marked "processing" with an expired claim time. It treats that invoice as unfinished and sends it again with the same unique ID as the first time. The government replies with the result of the first send, and Tubo then marks the invoice as submitted.

Step by step:

1. Before sending, the worker marks the invoice "processing" and sets a claim time, for example two minutes from now. This says "someone is working on this".
2. The crash happens. The claim time runs out and nobody finishes the job.
3. The restarted worker looks for invoices that are "processing" but whose claim time has passed. It finds `INV-10001`.
4. It sends the invoice again, using the invoice ID as the unique ID.
5. The government recognizes that ID, does not create a second copy, and answers with the earlier result.
6. Tubo saves "submitted" and writes the attempt in the history.

**Today:** the background job runs inside the API server with no claim time and nothing that looks for unfinished work. After a crash the invoice stays on "processing" forever. This is a known gap and is the first thing I would fix.

### I2. How will you prevent a duplicate submission?

> **Answer:** Three layers. Every send carries the invoice ID as a unique ID, so the government can spot a repeat. A claim on each invoice means only one worker handles it at a time. And the database allows only one invoice per company and invoice number, so a duplicate can't be created in Tubo either.

| Layer | What it stops |
|---|---|
| Unique ID sent with every submission | The government creating a second copy after a resend |
| Claim on the invoice while it is being worked on | Two workers sending the same invoice at the same time |
| One invoice per company and invoice number in the database | Two copies of the invoice being stored in Tubo |

If the government service did not support a unique ID, I would first ask it "do you already have `INV-10001`?" before every resend. That is slower and less safe than the unique ID, so I would push for the unique ID.

**Today:** the one-invoice-per-company rule is built. The unique ID and the claim are not.

### I3. What is idempotency, and how would you use it here?

> **Answer:** Idempotency means doing the same request twice has the same result as doing it once. I would use it by sending the invoice ID with every submission, so a resend after a crash returns the original answer and creates nothing new.

A simple way to think about it: pressing the lift button five times does not call five lifts. The lift knows you already asked.

In this scenario:

- The invoice ID never changes, so it is a good unique ID.
- The first send is accepted by the government, and the government remembers the ID.
- The resend after the crash carries the same ID. The government sees it has done this one and returns the same result.
- Tubo can resend as many times as it needs, and the government still ends up with exactly one copy.

---

## Part J: The concurrency problem

The code in the question looks first, "does this invoice exist?", and creates it if not. Two requests can both look at the same moment, both see "no", and both create.

### J1. Is the code safe?

> **Answer:** No. The check and the create are two separate steps, so another request can slip in between them.

### J2. What could happen?

> **Answer:** Both requests create `INV-10001`, so the company ends up with two copies of one invoice and may submit it to the government twice. If a database rule exists, one request fails with an error instead, and the code must handle that error properly.

### J3. Why could both requests pass the check?

> **Answer:** Because the check only sees what is already saved. Both requests check before either has saved anything, so both are told "not found".

A timeline:

| Moment | Request 1 | Request 2 |
|---|---|---|
| 1 | Looks for `INV-10001`. Not found. | |
| 2 | | Looks for `INV-10001`. Not found. |
| 3 | Creates it. | |
| 4 | | Creates it too. |

### J4. How would you fix it?

> **Answer:** Stop checking first. Just try to create the invoice, let the database refuse the second one, and turn that refusal into a clear "already exists" reply.

```javascript
try {
  await Invoice.create({ companyId, invoiceNumber, total });
} catch (error) {
  if (isAlreadyExistsError(error)) {
    // Tell the caller this invoice number is already used (HTTP 409)
    throw new ConflictError('Invoice number already exists');
  }
  throw error;
}
```

The database handles the two requests one at a time, so exactly one succeeds. The other gets the "already exists" error.

### J5. Would checking in the application alone be enough?

> **Answer:** No. Application checks are fine for friendly error messages, but they can't stop two requests that run at the same moment, and they can't stop a second server or a script that skips the check.

### J6. What database feature would you use?

> **Answer:** A unique rule across company and invoice number. The database then refuses any second invoice with the same pair, no matter how many requests arrive at once.

**Today:** this is built. The invoice table has a unique rule on company and invoice number, and the code handles the "already exists" error by returning `409`. The create code does not do the risky check first.

---

## Part K: Scaling from 10,000 to 1,000,000 invoices a day

First, the numbers. They are smaller than they sound, which helps decide what to change.

| | Per day | Average per second | Busy moments (about 10 times the average) |
|---|---|---|---|
| Now | 10,000 | about 0.1 | about 1 |
| Later | 1,000,000 | about 12 | about 120 |

The average load is not huge. The real problems are busy moments, the slow government service, and not being able to rely on a single machine.

### K1. How would you change the architecture?

> **Answer:** Run several copies of the API behind a traffic splitter, keep the database as the single source of truth with a backup copy, move the waiting list into a proper queue, run many workers that can be added or removed, and add shared monitoring and logs so we can see all the machines in one place.

| Area | Change |
|---|---|
| **API servers** | Run several identical copies. None of them keeps anything in memory that others need, so any copy can answer any request. |
| **Traffic splitting** | A load balancer sends each request to a healthy copy and stops sending to a copy that is down. |
| **Database** | Keep one main database for writes. Add read-only copies for lists and dashboards. Add the right search indexes, back it up, and have a standby ready to take over. Later, old invoices can be moved to cheaper storage. |
| **Queue** | At today's size the invoice table works as the waiting list. At around a million a day I would move to a proper queue service, so waiting work does not compete with normal database traffic. |
| **Workers** | Run them as separate programs from the API. Add more when the waiting list grows, remove them when it shrinks. |
| **Caching** | Keep a short-lived copy of things that rarely change, such as company details. Don't cache invoice status, because it changes often and people expect it to be current. |
| **File storage** | If we later store the original invoice files or PDFs, keep them in a file storage service, not in the database. The database only stores a link. |
| **Logging** | Every machine sends logs to one shared place. Each request carries a request ID so one invoice can be followed across machines. |
| **Monitoring** | Charts and alerts for the waiting list size, the age of the oldest waiting invoice, failure rate, government response time, and database health. |

**Today:** one API server, one database, and the background work inside the API process. None of the above exists yet, and it is not needed at 10,000 a day.

### K2. 100,000 invoices arrive in 10 minutes and the government allows 100 a second. What do you do?

> **Answer:** Accept all of them right away and store them, but send them to the government at a controlled speed below 100 a second. The extra invoices wait in line in the database and are sent as fast as the limit allows.

The numbers:

- 100,000 invoices in 10 minutes is about 167 a second coming in.
- The government accepts at most 100 a second.
- At a safe speed of about 80 a second, clearing the 100,000 takes about 21 minutes. At the full 100 a second it takes about 17 minutes.

How I would control the speed:

1. All workers share one speed limit, so adding workers never pushes the total above the limit.
2. I would aim for about 80% of the limit, to leave room for retries and spikes.
3. If the government answers "slow down" or starts failing, the workers slow down or pause for a while.
4. Customers are not hurt, because their invoices are already safely accepted. They just show "pending" for a few more minutes.

### K3. Would you process all invoices at the same time?

> **Answer:** No. Doing everything at once would break the government's limit, run the database out of connections, and make the failures worse. I would process them in controlled batches with a fixed number of workers.

Why not everything at once:

- **The government limit.** Sending all at once would be rejected, and rejected invoices need retries, which makes the traffic worse.
- **Our own database.** Each active job needs a database connection. Too many at once and normal API requests start failing.
- **No gain.** Past a certain point, more simultaneous jobs don't finish any sooner.

My approach: a fixed number of workers, each taking a small batch, with one shared speed limit. Oldest invoices go first so nobody waits forever, and new invoices are not blocked behind retries.

---

## Part L: Recording every failed attempt

### How I would record each attempt

Every attempt, success or failure, gets its own row in the processing history. A row is added when the attempt starts and completed when it ends. Rows are never changed afterwards and never deleted.

For `INV-20001`, which failed three times, the history would look like this:

| Attempt | Started | Ended | Government reply | Error message | Result |
|---|---|---|---|---|---|
| 1 | 10:00:00 | 10:00:03 | 503 | Service unavailable | Failed, will retry |
| 2 | 10:00:33 | 10:00:36 | 503 | Service unavailable | Failed, will retry |
| 3 | 10:01:36 | 10:01:39 | Timeout | No reply in time | Failed, will retry |

Each row holds: the invoice, the attempt number, start time, end time, the government's reply code, the error message and the result.

**Today:** each attempt is saved as a log message, with the attempt number, start and end times and reply code tucked into an extra data field. The attempt number is found by searching the message text. This works for a demo but is fragile. I would give these values their own proper columns.

### L1. Would you overwrite the previous error every time?

> **Answer:** No. Overwriting would hide the history, so we couldn't tell whether an invoice failed the same way three times or three different ways. Each attempt is its own row, and the invoice itself only shows the latest state.

Reasons to keep every row:

- The pattern matters. Three timeouts points at the government. Three "invalid tax ID" replies point at the invoice.
- It is an audit trail. For tax and legal matters, we need to show what happened and when.
- Support and developers need it to find the cause.
- It costs very little. Rows are small.

### L2. How would support investigate a failure from three days ago?

> **Answer:** They look up the invoice by number, open its attempt history, and read each attempt in time order: when it ran, what the government said, and what error we recorded. If more detail is needed, the request ID on that attempt leads to the full application logs from that time.

Step by step:

1. Search for the invoice by its number in the dashboard.
2. Open it and read the history from the first attempt to the last.
3. Check the pattern. Was it one long outage, or one bad invoice that was rejected the same way each time?
4. For the exact technical details, use the request ID to find the matching entries in the shared logs, as long as logs from that day are still kept.
5. Decide the action. If it was a temporary problem, press Retry. If the government rejected the invoice data, fix the data and send a corrected invoice.

This is why history rows are kept for a long time and never overwritten. Detailed logs can be deleted after a few weeks, but the attempt history stays with the invoice.

---

## Part M: Changing the API without breaking customers

### How would you introduce the change?

> **Answer:** Keep V1 working exactly as it is and add a new V2 next to it. Existing customers carry on with V1 until they choose to move, and the customer who needs the new fields uses V2. V1 is retired only after a long notice period.

The plan:

1. **Add `/api/v2/invoices`** with the new structure. `/api/v1/invoices` is left alone.
2. **Share the core work.** Both versions pass their data into the same checking, saving and sending code. Only the translation at the edge differs. V1 data is converted into the new internal shape, with sensible defaults for the new fields.
3. **Don't change the database in a way that breaks V1.** New fields are added as optional, so V1 requests still save correctly.
4. **Only create a new version for breaking changes.** Adding an optional field to a response does not break anyone, so that can go into V1 directly. Renaming, removing or restructuring fields needs V2.
5. **Tell customers early.** Publish the V2 documentation and a retirement date for V1, with a generous notice period (for example six months). Add a warning header to V1 responses.
6. **Watch who still uses V1.** Count requests per version and per customer. Contact customers who are still on V1 before the retirement date.
7. **Test both versions** on every release, so a V2 change never breaks V1 by accident.
8. **Retire V1 only when usage is gone** or the notice period has passed.

**Today:** the API is at `/api/...` with no version number. Putting `/api/v1/` in the path is an open decision. It is cheap to add now and painful to add once customers depend on the old path, so I would add it before any customer goes live.

---

## Part N: Debugging "invoices take hours"

The monitoring shows:

| Measure | Value | Looks |
|---|---|---|
| Server CPU | 35% | Fine |
| Memory | 55% | Fine |
| Database CPU | 20% | Fine |
| API response time | Normal | Fine |
| External government service | Answering normally | Fine |
| **Waiting invoices** | **150,000** | **Problem** |
| **Workers** | **5** | **Likely the limit** |

### N1. Where would you investigate first?

> **Answer:** At the workers. Everything else looks healthy, but 150,000 invoices are waiting and only 5 workers are taking them. I would check how many invoices each worker finishes per minute, and how long each one takes.

### N2. What do these metrics suggest?

> **Answer:** Nothing is overloaded. The machines, the database and the government service all have spare room, so the slowdown is that we aren't using it. There are too few workers, or each worker handles one invoice at a time and spends most of its time waiting for replies.

A rough check using the mock service's timing, about 3 seconds per invoice:

- One worker doing one invoice at a time finishes about 20 a minute.
- Five workers finish about 100 a minute, or about 6,000 an hour.
- 150,000 waiting invoices would take about 25 hours to clear, and that is before any new ones arrive.

That matches "several hours", and it explains why the CPU is low. The workers are mostly sitting and waiting for the government's reply, not working hard.

### N3. What other measures would you check?

> **Answer:** How fast invoices arrive compared to how fast they finish, how long each submission takes, how old the oldest waiting invoice is, how many waiting invoices are retries, and what share of attempts fail.

| Measure | What it tells us |
|---|---|
| Invoices arriving per minute vs finishing per minute | Whether the line is growing or shrinking, and how fast |
| Time taken per submission | Whether each send is slow, and whether it got slower recently |
| Age of the oldest waiting invoice | What customers actually experience |
| How many waiting invoices are retries | Whether failing invoices are clogging the line |
| Failure rate and kinds of failures | Whether many attempts are wasted |
| Government rate limit usage | How much room we still have before hitting their limit |
| Database connections in use | How many more workers the database can support |
| Worker health | Whether any of the 5 workers is stuck or restarting |
| Time spent waiting for claims | Whether workers are blocking each other when picking up work |

### N4. What changes might improve throughput?

> **Answer:** Add more workers, let each worker handle several invoices at once while it waits for replies, and let workers pick up invoices in small batches. Then deal with whatever turns up in the extra measures, such as retries clogging the line.

In order of effort:

1. **More workers.** The simplest fix. Going from 5 to 20 would cut the clearing time from about 25 hours to about 6.
2. **Several invoices per worker.** A worker that sends 10 invoices at the same time, instead of one, does ten times the work while mostly waiting.
3. **Batch pickup.** Taking 20 invoices per trip to the database instead of 1 reduces the overhead.
4. **Separate retries from new invoices.** Failing invoices should not block fresh ones.
5. **Shorten the wait for replies.** Set a sensible time limit so a slow reply doesn't hold a worker for a long time.
6. **Scale automatically.** Add workers when the waiting list is long, and remove them when it is short.

### N5. How do you make sure more workers don't overload something else?

> **Answer:** Increase in steps, watch the other parts as you go, and put hard limits in place. One shared speed limit protects the government service, a cap on connections protects the database, and a pause switch stops everything if errors start climbing.

| What could be overloaded | How I would protect it |
|---|---|
| **The government service** | One speed limit shared by all workers, below their published limit. Adding workers can never exceed it. |
| **Our database** | A cap on database connections per worker, and a total cap. Check the connection count before each increase. |
| **Our own API** | Workers run on separate machines from the API, so they can't take the API's CPU or memory. |
| **Everything, if the government goes down** | A pause switch: if many recent sends fail, workers stop for a short while and then test with a single invoice. |
| **Our own mistakes** | Add workers gradually (for example 5, 10, 20), wait a few minutes at each step, and check errors and response times before the next step. Set a maximum worker count for automatic scaling. |
