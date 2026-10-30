# Technology Stack

Tubo runs on the developer's machine. PostgreSQL runs in Docker. The design does not depend on any hosted platform.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict mode, in backend and frontend |
| Backend | Node.js with Express |
| ORM and migrations | Prisma (`backend/prisma/schema.prisma`) |
| Database | PostgreSQL 16 in Docker (`docker-compose.yml`) |
| Money | Prisma `Decimal` with `@db.Decimal(12, 2)` |
| Validation | Zod |
| Authentication | Email and password. Passwords are hashed with bcrypt. The backend signs JWTs with `JWT_SECRET`. |
| Frontend | React with Vite (single-page app), TypeScript |
| Package manager | npm, with `package-lock.json` committed in each app |

Frontend libraries beyond React and Vite (UI kit, routing, data fetching, forms) are not chosen yet. Add each one to this table when it is chosen.

## Local services

| Service | How to run | Address |
|---|---|---|
| PostgreSQL | `docker compose up -d postgres` from the repository root | `localhost:5433` (container port 5432) |
| Backend API | `npm run dev` in `backend/` | `http://localhost:4000` (from `PORT`) |
| Frontend | `npm run dev` in `frontend/` | Vite's default address |
| Government service | Local stand-in (see Rules) | Set by `GOVERNMENT_API_BASE_URL` |

Database connection format: `DATABASE_URL=postgresql://<user>:<password>@localhost:5433/<database>`. Put real values in `backend/.env`. Never write them in code.

## Rules

- **Database access:** Prisma is the only database client. Schema changes go through Prisma migrations (see `structure.md`).
- **Work queue:** the `invoices` table is the queue. A worker claims due rows with `SELECT ... FOR UPDATE SKIP LOCKED` (through Prisma `$queryRaw`) and sets `lockedUntil` on each claimed row. Do not add a message broker or a job library.
- **Request path:** a `POST` to create an invoice stores the row as `PENDING` and returns `202 Accepted`. Government submission never runs inside the request.
- **Worker process:** the worker runs as its own Node process, started by an npm script in `backend/`. A worker crash or restart must not stop the API.
- **Government API:** the base URL comes from `GOVERNMENT_API_BASE_URL`. Code never hard-codes it.
- **Local stand-in:** until a real government service exists, the submission call in `backend/src/modules/invoices/processor.ts` returns a random result: success (200), temporary failure (503), invalid invoice (400), or timeout. When a real service exists, replace the stand-in with an HTTP call to `GOVERNMENT_API_BASE_URL`.
- **Idempotency key:** every submission sends the invoice `id` as an `Idempotency-Key` header, so the government service can recognize a repeated submission.
- **Config:** every environment variable is parsed with Zod at startup. The process exits if the config is invalid.
- **Casing:** Prisma fields, database columns, and API JSON are all `camelCase`. Table names are plural `snake_case` through `@@map`. See `naming-conventions.md`.

## Open items (not decided; do not assume)

- Whether API paths use a `/api/v1/` prefix. The code uses `/api/...`, and the assessment shows both forms.
- Whether the government stand-in becomes a separate HTTP service in the repository.
