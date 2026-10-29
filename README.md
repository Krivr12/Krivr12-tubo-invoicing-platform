# Krivr12-tubo-invoicing-platform

## Environments

The app has two environments, each with its own Supabase cloud project and database. Git branches map to environments as follows:

| Git branch | Environment | Supabase project | Vercel target |
|---|---|---|---|
| `dev` | Development (integration) | `tubo-dev` | Preview |
| `main` | Production | `tubo-prod` | Production |

Feature work happens on short-lived `feature/*` branches. Each one is merged into `dev` after review. `dev` is merged into `main` only for production releases.

Credentials for each environment are stored outside Git, in local `.env` files or in Vercel's environment variable settings. See `.env.example` in `backend/` and `frontend/` for the required variables.
