# Naming Conventions

These rules come from `milestones.md`, Section 4, and the JSON casing decision (D6).

| Item | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `invoice-repository.ts`, `create-invoice.tsx` |
| Types, interfaces, classes | `PascalCase` | `InvoiceRepository`, `AppError` |
| React components | `PascalCase` | `InvoiceDashboard`, `StatusBadge` |
| Variables and functions | `camelCase` | `companyId`, `calculateTotals` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_BATCH_SIZE`, `JOIN_CODE_TTL_DAYS` |
| Enum values | `UPPER_SNAKE_CASE` strings | `PENDING`, `PROCESSING`, `SUBMITTED`, `FAILED` |
| `failure_type` values | `UPPER_SNAKE_CASE` strings | `RETRYABLE`, `PERMANENT` |
| Database tables | plural `snake_case` | `invoices`, `invoice_items`, `invoice_processing_logs` |
| Database columns | `snake_case` | `company_id`, `next_retry_at`, `locked_until` |
| API JSON fields | `camelCase` | `invoiceNumber`, `customerTaxId` |
| Environment variables | `UPPER_SNAKE_CASE` | `SUPABASE_SERVICE_ROLE_KEY`, `GOVERNMENT_API_BASE_URL` |

## Mapping between layers (D6)

- The database uses `snake_case`. The API uses `camelCase`.
- The repository layer converts between them. Services and controllers work with `camelCase` objects only.
- Do not write field renaming in controllers or components.

## Root-level documents

`README.md`, `app_guide.md`, and `milestones.md` are the root documents. They keep their existing uppercase or conventional names. This is the only exception to the `kebab-case` file rule.

## Other rules

- Names describe the thing, not the implementation. Use `companyId`, not `cid`.
- Avoid abbreviations except widely known ones (`id`, `url`, `http`).
