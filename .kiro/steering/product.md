# Product: Tubo

Tubo is an electronic invoicing platform. Businesses send invoices to Tubo. Tubo validates and stores each invoice, then submits it to an external government invoicing service.

This repository is a full-stack technical assessment. The source of requirements is `app_guide.md`. The implementation plan and decisions are in `milestones.md`. When the two disagree, `milestones.md` holds the confirmed decisions and `app_guide.md` holds the original requirements.

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

- An invoice is never lost and never submitted twice, even when the server crashes or the government API times out.
- `POST` accepts an invoice and returns `202 Accepted`. Submission to the government service happens after the response.
- Invoice statuses are `PENDING`, `PROCESSING`, `SUBMITTED`, and `FAILED`. A `FAILED` invoice also has a `failure_type` of `RETRYABLE` or `PERMANENT`.
- A `PERMANENT` failure (government HTTP 400) is never retried automatically.
- Every processing attempt is stored as its own record. Earlier errors are never overwritten.
- Each user belongs to exactly one company. A user must never read or change another company's data.
- A user joins a company with a company identifier (`slug`) and a join code. Join codes expire 7 days after generation.

## Scope

- Time budget: 2 days.
- Production is deployed on Vercel. Scope cuts follow the cut-line rule in `milestones.md`, Section 3.
- Written answers to the assessment questions live in `README.md`.
