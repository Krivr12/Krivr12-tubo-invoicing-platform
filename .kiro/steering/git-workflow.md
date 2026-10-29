# Git Workflow

These rules come from the Git usage row in `milestones.md`, Section 4, and the branching decision (D2).

## Branches

- `main`: production. It matches what is deployed to Vercel Production with `tubo-prod`.
- `dev`: integration. It matches the `tubo-dev` Supabase project and the Vercel Preview deployments.
- `feature/*`: short-lived branches for one piece of work. Example: `feature/m1-invoice-schema`.

Flow:

1. Create a `feature/*` branch from `dev`.
2. Commit small, focused changes to the feature branch.
3. Merge the feature branch into `dev` after it is verified.
4. Merge `dev` into `main` for a production release.

## Commit messages

Use Conventional Commits:

- `feat:` new behavior
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling, config, and housekeeping
- `refactor:` code change without behavior change
- `test:` tests only

Example: `feat: add invoice total calculation helper`

Keep each commit small and focused on one change.

## Secrets

- No secrets in Git history. Check before every commit that no `.env` file or key is staged.
- `.gitignore` covers `.env*` except `.env.example`.
- If a secret is committed by mistake, rotate it. Removing it from history is not enough.

## Schema changes

- Schema changes go only in migration files under `supabase/migrations/`.
- A migration is committed with the code that depends on it.

## Destructive operations

- Do not force-push to `main` or `dev`.
- Do not rewrite history on shared branches.
