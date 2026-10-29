# Error Handling

These rules come from the Error handling row in `milestones.md`, Section 4.

## Error classes

- All expected errors extend a single `AppError` class.
- Every `AppError` has a stable `code` (for example `INVOICE_NOT_FOUND`, `DUPLICATE_INVOICE`, `INVALID_JOIN_CODE`). Clients may rely on the code. The message is for humans and may change.
- Put error classes in `backend/src/lib/`.

## Response shape

Every error response uses this shape:

```json
{
  "error": {
    "code": "DUPLICATE_INVOICE",
    "message": "An invoice with this number already exists for your company.",
    "details": {}
  }
}
```

`details` is optional.

## Central middleware

- One error-handling middleware at the end of the Express chain converts every error to the response shape above.
- Controllers and services throw errors. They do not format error responses themselves.
- Unexpected errors become `500` with a generic message.

## What never reaches the client

- Stack traces.
- Database errors, SQL text, or constraint names.
- Internal service messages, such as government API response bodies, unless they are deliberately mapped to a safe message.

## Logging

- Every error is logged with the request ID.
- Request IDs are generated per request and returned in a response header.
- Logs must not contain secrets, tokens, join codes, or full invoice payloads.

## HTTP status codes

The codes used by the API are `400`, `401`, `404`, `409`, `422`, and `500` (M3).

- `401`: missing or invalid authentication.
- `404`: resource not found, including another company's resource.
- `409`: conflict, such as a duplicate invoice number or a retry on an ineligible invoice.
- `500`: unexpected server error.

Open item: which validation failures use `400` and which use `422` is not decided yet. Decide in M3 and record the decision in `milestones.md` before implementing.
