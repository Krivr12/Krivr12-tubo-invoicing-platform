# Project Structure

This layout is confirmed in `milestones.md`, Section 5. Create new folders only where this layout allows, or update this file first.

## Layout

```
tubo/
├── .kiro/
│   └── steering/                # these steering docs
├── backend/
│   ├── src/
│   │   ├── config/              # env loading and validation (Zod)
│   │   ├── routes/              # Express routers
│   │   ├── controllers/         # parse request, return response
│   │   ├── services/            # business rules
│   │   ├── repositories/        # the only place SQL / DB access lives
│   │   ├── middleware/          # auth, error handler, request id, rate limit
│   │   ├── schemas/             # Zod schemas for body, query, params
│   │   ├── integrations/        # government API client (external HTTP)
│   │   ├── jobs/                # processing service, claim logic, cron handler
│   │   ├── mock-government-api/ # mock service (D4)
│   │   ├── lib/                 # logger, errors, money, pagination
│   │   └── types/
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ui/       # shadcn components
│   │   ├── features/            # auth, invoices (pages, hooks, components)
│   │   ├── lib/                 # API client, utils
│   │   └── routes/
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── migrations/              # hand-written SQL migrations only
├── docs/
│   ├── architecture.md          # diagram
│   └── api/                     # Postman collection
├── README.md
├── app_guide.md
└── milestones.md
```

## Layer rules (backend)

Requests flow in one direction: `routes → controllers → services → repositories`.

- **Routes** wire paths to controllers and attach middleware. No logic.
- **Controllers** parse the request and send the response. No business rules.
- **Services** hold business rules, such as total calculation, retry eligibility, and status transitions.
- **Repositories** are the only code that runs SQL or touches the database.
- **Integrations** are the only code that makes outbound HTTP calls to external services.

## Frontend rules

- Organize by feature under `src/features/`. Each feature folder holds its own pages, hooks, and components.
- `src/components/ui/` holds shadcn components only. Shared reusable UI pieces (loading, empty, error states, status badge) live outside it.
- `src/lib/` holds the API client wrapper and general utilities.

## Migrations

- Schema changes are made only through hand-written SQL files in `supabase/migrations/`.
- Do not change the schema through the Supabase dashboard.
