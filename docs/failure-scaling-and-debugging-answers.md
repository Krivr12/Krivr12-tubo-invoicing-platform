# Parts I to N: Quick Answers

Short answers to the questions in [technical-assessment.md](./technical-assessment.md). Parts I, J and L are built. The one limit is that the mock government service ignores the idempotency key, so duplicate protection on the government side depends on the real service. Parts K, M and N describe the planned design.

---

## Part I: Critical Failure Scenario

### I1. What should happen next?

> The restarted worker finds the invoice still marked "processing" with an expired claim time, and treats it as unfinished. It sends it again with the same unique ID, and the government replies with the first result, so Tubo can mark it as submitted.

### I2. How will you prevent a duplicate submission in the external system?

> Every send carries the invoice ID as a unique ID, so the government can recognize a repeat. Only one worker can claim an invoice at a time, and the database allows only one invoice per company and invoice number.

### I3. What is idempotency, and how would you use it here?

> Idempotency means sending the same request twice has the same effect as sending it once. I would send the invoice ID with every submission, so a resend after the crash returns the original answer and creates nothing new.

---

## Part J: Concurrency Problem

### J1. Is the code safe?

> No. The check and the create are two separate steps, so another request can slip in between them.

### J2. What could happen?

> Both requests create `INV-10001`, leaving two copies of the same invoice. That could also lead to it being sent to the government twice.

### J3. Why could both requests pass the check?

> Both look before either has saved anything, so both are told "not found".

### J4. How would you fix it?

> Skip the check, try to create the invoice, and let the database refuse the second one. Then turn that refusal into a clear "already exists" reply.

### J5. Would application-level validation alone be sufficient?

> No. It can't stop two requests that run at the same moment, or a second server that skips the check.

### J6. What database mechanism would you use?

> A unique rule on company and invoice number. The database then accepts only one, however many requests arrive at once.

---

## Part K: Scalability

### K1. How would you modify the architecture?

> Run several copies of the API behind a load balancer, and add many workers that can be started or stopped as the waiting list changes. Move the waiting list into a proper queue, add database backups and read-only copies, and send logs and monitoring from every machine to one shared place.

### K2. 100,000 invoices arrive in 10 minutes and the government allows 100 requests/second. How do you avoid overwhelming it?

> Accept and store every invoice right away, then send them at a controlled speed a little under 100 a second, shared across all workers. The rest wait their turn, and the customer sees "pending" until it is sent.

### K3. Would you process all invoices simultaneously?

> No. Sending everything at once would break the government's limit and run the database out of connections. I would use a fixed number of workers that take small batches, oldest invoices first.

---

## Part L: Failure and Retry Design

### How should Tubo record each attempt?

> Each attempt gets its own history row, with attempt number, start time, end time, the government's reply code, the error message and the result. A row is opened when the attempt starts and completed when it ends, and earlier attempts are never overwritten.

### L1. Would you overwrite the previous error every time?

> No. Overwriting would hide the history, so we couldn't tell whether an invoice failed the same way three times or in three different ways.

### L2. How would a support engineer investigate a failure from three days ago?

> They find the invoice by number and read its attempt history in order, to see what the government said each time. If they need more detail, the request ID on that attempt leads to the full logs from that time.

---

## Part M: API Versioning

### How would you introduce the change without breaking V1 customers?

> Keep `/api/v1` working as it is and add `/api/v2` with the new structure. Both share the same core logic, and V1 is retired only after customers have had a long notice period to move.

---

## Part N: Debugging Scenario

### N1. Where would you investigate first?

> At the workers. Everything else looks healthy, but 150,000 invoices are waiting and only 5 workers are taking them.

### N2. What do these metrics suggest?

> Nothing is overloaded, so the system has spare room that isn't being used. There are too few workers, or each one handles a single invoice at a time and mostly waits for replies.

### N3. What additional metrics would you check?

> How fast invoices arrive versus finish, how long each submission takes, and how old the oldest waiting invoice is. Also how many waiting invoices are retries, and how many attempts fail.

### N4. What changes might improve throughput?

> Add more workers, and let each worker handle several invoices at once while it waits for replies. Take invoices in small batches, and keep retries from blocking new invoices.

### N5. How would you ensure more workers don't overload another component?

> Add workers in steps and check the other parts after each step. Use one shared speed limit for the government, a cap on database connections, and a pause switch if errors start climbing.
