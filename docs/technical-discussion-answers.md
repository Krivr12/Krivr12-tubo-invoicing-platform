# Technical Discussion: Part Q

Short answers to the ten questions in Part Q of [technical-assessment.md](./technical-assessment.md). Where something is planned and not built yet, the answer says so.

---

### 1. Why did you choose this architecture?

I kept it simple: one API, one database, and a clear rule that the API saves an invoice first and sends it to the government later. This keeps invoices safe even when the government service is slow or down, and it is easy to grow because the database already holds all the state.

### 2. What is the weakest part of your current implementation?

The background sending runs inside the API server, so if the server stops, an invoice can be left stuck on "processing", and failed sends are not retried automatically. That is the first thing I would fix.

### 3. What would you improve with another two days?

I would move the sending into its own worker program that reclaims stuck invoices and retries temporary failures with growing delays. Then I would send the invoice ID as a unique ID to the government, and add tests that prove one company can't see another company's data.

### 4. What happens when the database becomes unavailable?

The API can't save anything, so it returns an error and the customer knows to try again, which means nothing is accepted and then lost. The worker pauses and keeps trying to reconnect, and once the database is back it carries on from where it stopped because all the state lives there. *(Today the worker has no reconnect handling. This is planned.)*

### 5. What happens if a worker crashes?

The invoice it was working on is left marked "processing" with a claim time that soon runs out. Another worker then picks it up and sends it again with the same unique ID, so the government can't create a copy. *(Planned. Today a crash leaves the invoice stuck.)*

### 6. How do you prevent duplicate processing?

There are three protections. The database allows only one invoice per company and invoice number, only one worker can claim an invoice at a time, and every send includes the invoice ID so the government can spot a repeat. *(The first one is built. The other two are planned.)*

### 7. How do you scale workers?

By starting more copies of the worker program. Each copy takes different invoices, so they don't clash, and all copies share one speed limit so the total never goes over what the government allows.

### 8. How do you protect one company's data from another company?

The company is taken from the signed login token, never from anything the user types. Every database query includes that company, and asking for another company's invoice returns "not found" so its existence isn't revealed. *(Built. Automated tests for this are still to be written.)*

### 9. How would you monitor the application in production?

I would watch the number of waiting invoices, the age of the oldest one, how many sends fail, how long the government takes to reply, and the health of the database. Alerts would go to the team when the line grows, errors spike, or the oldest invoice has waited too long.

### 10. How would you deploy a new version without significantly interrupting invoice processing?

I would update the API and workers one at a time, so there is always a copy running. Workers finish the invoice they are on before stopping, and any invoice that is interrupted is picked up again after its claim time runs out. Database changes are done in small steps that work with both the old and the new version.
