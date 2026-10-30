# Git Workflow

## Branches

- `main`: the release branch. It holds the version that is ready to submit or demo.
- `dev`: integration. Verified feature work lands here first.
- `feature/*`: short-lived branches for one piece of work. Example: `feature/invoice-schema`.

Flow:

1. Create a `feature/*` branch from `dev`.
2. Commit small, focused changes to the feature branch.
3. Merge the feature branch into `dev` after it is verified.
4. Merge `dev` into `main` for a release.

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

- No secrets in Git history. Before every commit, check that no `.env` file or key is staged.
- `.gitignore` covers `.env*` except `.env.example`.
- If a secret is committed by mistake, rotate it. Removing it from history is not enough.

## Schema changes

- Schema changes go only in `backend/prisma/schema.prisma`, with the generated migration in `backend/prisma/migrations/`.
- A migration is committed with the code that depends on it.

## Destructive operations

- Do not force-push to `main` or `dev`.
- Do not rewrite history on shared branches.
