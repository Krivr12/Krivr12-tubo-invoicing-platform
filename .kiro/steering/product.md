# Product: Tubo

Tubo is an electronic invoicing platform. Businesses send invoices to Tubo. Tubo validates and stores each invoice, then submits it to an external government invoicing service.

This repository is a full-stack technical assessment. The target design and questions are in `docs/technical-assessment.md`. Endpoints are listed in `docs/api-endpoints.md`, and the data model is in `docs/data-model-and-design.md`. Written answers to the assessment questions go in `README.md`.

## Priority order

When trade-offs appear, apply this order:

1. Correctness
2. Data integrity
3. Backend design
4. Reliability
5. Security
6. Maintainability
7. UI

## Core behavior

- An invoice is never lost and never submitted twice, even when the server or worker crashes or the government service times out.
- `POST /api/invoices` validates the request, stores the invoice as `PENDING`, and returns `202 Accepted` with the invoice ID. Government submission happens after the response, in the worker.
- Invoice statuses are `PENDING`, `PROCESSING`, `SUBMITTED`, and `FAILED`.
- A `FAILED` invoice has a `failureType` of `RETRYABLE` or `PERMANENT`.
  - `PERMANENT` covers a government HTTP 400. It is never retried automatically, and a manual retry is not allowed.
  - `RETRYABLE` covers a government HTTP 503 and a timeout. The worker retries it automatically with exponential backoff, using `nextRetryAt`, until the attempt limit is reached. After that the invoice stays `FAILED` and a manual retry is allowed.
- Every processing attempt is stored as its own record in `processing_logs`, with attempt number, start and end times, HTTP status, error message, and the resulting status. Earlier records are never overwritten.
- A crash during processing leaves the invoice in `PROCESSING` with an expired `lockedUntil`. The worker reclaims it on its next pass. The idempotency key prevents a second submission to the government service.
- Each user belongs to exactly one company. A user must never read or change another company's data.
- A user joins a company with a company identifier (`slug`) and a join code. Join codes expire 7 days after generation. This flow is planned and is not in the schema yet.

## Scope

- The assessment time budget is two days. When time runs short, cut from the bottom of the priority order first.
- Document each production gap that is not built in `README.md`, with the reason it was left out.
