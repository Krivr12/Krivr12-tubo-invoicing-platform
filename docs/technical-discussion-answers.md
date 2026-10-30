# Technical Discussion: Part Q

Short answers to the ten questions in Part Q of [technical-assessment.md](./technical-assessment.md). Where something is not built yet, the answer says so.

---

### 1. Why did you choose this architecture?

The API saves an invoice first and a separate worker sends it to the government later, with the database holding all the state. This keeps invoices safe when the government service is slow or down, and it stays simple because there is no second system to keep in step.

### 2. What is the weakest part of your current implementation?

Duplicate protection at the government depends on the government honoring the idempotency key, and my mock service ignores it, so I can't show that part working. There are also no automated tests, and nothing limits the total request speed across workers.

### 3. What would you improve with another two days?

I would make the mock remember keys so deduplication can be demonstrated, and add tests for tenant isolation and crash recovery. Then I would add a shared speed limit and pause switch for the workers, automatic status refresh in the frontend, and basic web hardening (restricted CORS, security headers, body size limit).

### 4. What happens when the database becomes unavailable?

The API can't save anything and returns an error, so nothing is accepted and then lost. The worker catches the error, waits a second and tries again, and carries on once the database is back, because all the state lives there.

### 5. What happens if a worker crashes?

The invoice it was working on stays "processing" until its lock runs out (60 seconds by default). Another worker then claims it and sends it again with the same ID, which the government can use to avoid a second copy.

### 6. How do you prevent duplicate processing?

There are three protections. The database allows only one invoice per company and invoice number, a locked claim lets only one worker handle an invoice at a time, and every send carries the invoice ID so the government can recognize a repeat. The first two are fully in place, and the third needs the real government service to honor the ID.

### 7. How do you scale workers?

By starting more copies of the worker. Each copy claims different invoices, so they don't clash. A shared speed limit across copies is not built yet, so today the total speed is controlled only by how many workers run and their batch size.

### 8. How do you protect one company's data from another company?

The company is taken from the signed login token, never from anything the user types. Every database query includes that company, and asking for another company's invoice returns "not found" so its existence isn't revealed. Automated tests for this are still to be written.

### 9. How would you monitor the application in production?

I would watch the number of waiting invoices, the age of the oldest one, how many sends fail, how long the government takes to reply, and the health of the database. Alerts would go to the team when the line grows, errors spike, or the oldest invoice has waited too long. None of this is built yet.

### 10. How would you deploy a new version without significantly interrupting invoice processing?

I would update the API and workers one at a time, so there is always a copy running. A worker finishes its current batch before stopping, and any interrupted invoice is picked up again after its lock expires. Database changes would be done in small steps that work with both the old and the new version.
