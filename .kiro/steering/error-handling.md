# Error Handling

## Error classes

- Expected errors extend a single `AppError` class, defined in `backend/src/middleware/errorHandler.ts`.
- Every `AppError` has a stable `code`, such as `INVOICE_NOT_FOUND`, `DUPLICATE_INVOICE`, `RETRY_NOT_ALLOWED`, `INVOICE_TOTALS_MISMATCH`, or `INVALID_JOIN_CODE`. Clients may rely on the code. The message is for humans and may change.

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

`details` is optional. For validation errors, it lists each failing field and its message.

## Central middleware

- One error handler sits at the end of the Express chain in `app.ts`. It converts every error to the shape above.
- Controllers and services throw errors. They never format error responses themselves.
- Zod errors become `400` with code `VALIDATION_FAILED`.
- Prisma unique-constraint violations (`P2002`) become `409` with code `DUPLICATE_INVOICE`. Map only the known Prisma codes. Everything else is unexpected.
- Unexpected errors become `500` with code `INTERNAL_ERROR` and the message "An unexpected error occurred."

## What never reaches the client

- Stack traces.
- Database errors, SQL text, or constraint names.
- Government API response bodies or internal service messages. Map them to a safe message if the client needs to know the outcome.

## Logging

- Log every error with the request ID.
- Generate a request ID per request and return it in the `X-Request-Id` response header.
- Logs must not contain secrets, tokens, join codes, or full invoice payloads.

## HTTP status codes

- `400`: the request is malformed. Zod rejects the body, query, or path parameters.
- `401`: authentication is missing or invalid.
- `404`: the resource does not exist, including another company's resource.
- `409`: a conflict. Examples: a duplicate invoice number for the company, or a retry on an invoice whose `failureType` is not `RETRYABLE`.
- `422`: the request is well formed but breaks a business rule. Examples: a line total that does not equal quantity × unit price + tax, or invoice totals that do not match the items.
- `500`: unexpected server error.
