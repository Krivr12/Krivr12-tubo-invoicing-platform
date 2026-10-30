# Naming Conventions

These conventions match the Prisma schema in `backend/prisma/schema.prisma`, which uses `camelCase` columns.

| Item | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `invoice-status-badge.tsx`, `auth-middleware.ts` |
| Types, interfaces, classes | `PascalCase` | `AppError`, `AuthenticatedRequest` |
| React components | `PascalCase` | `InvoiceDashboard`, `StatusBadge` |
| Variables and functions | `camelCase` | `companyId`, `calculateTotals` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS`, `JOIN_CODE_TTL_DAYS` |
| Invoice status values | `UPPER_SNAKE_CASE` strings | `PENDING`, `PROCESSING`, `SUBMITTED`, `FAILED` |
| `failureType` values | `UPPER_SNAKE_CASE` strings | `RETRYABLE`, `PERMANENT` |
| Database tables | plural `snake_case` (mapped with `@@map`) | `invoices`, `invoice_items`, `processing_logs` |
| Database columns and Prisma fields | `camelCase` | `companyId`, `nextRetryAt`, `lockedUntil` |
| API JSON fields | `camelCase` | `invoiceNumber`, `customerTaxId` |
| Environment variables | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET`, `GOVERNMENT_API_BASE_URL` |

## Casing across layers

- Database columns, Prisma fields, and API JSON all use `camelCase`.
- No field-renaming layer is needed. Services and controllers use the same field names as the database.
- Table names stay plural `snake_case`, set by `@@map` in the Prisma schema.

## Root-level files

`README.md` and `docker-compose.yml` keep their conventional names. They are the only exceptions to the `kebab-case` file rule.

## Other rules

- Names describe the thing, not the implementation. Use `companyId`, not `cid`.
- Avoid abbreviations except widely known ones (`id`, `url`, `http`).
