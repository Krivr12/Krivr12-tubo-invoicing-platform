# Security Rules

## Secrets

- Secrets come only from environment variables. Code never contains them, and logs never print them.
- Commit only `.env.example` files, with placeholder values. `.env` and other `.env*` files are gitignored.
- Never commit the database password, `JWT_SECRET`, or government API credentials.
- The credentials in `docker-compose.yml` are for the local Postgres container only. Use different values for any shared or hosted database.
- The backend refuses to start if `JWT_SECRET` is missing. The code has no fallback secret value.

## Authentication

- Authentication uses email and password. Passwords are hashed with bcrypt before storage. Plain passwords are never stored or logged.
- Login returns a JWT signed with `JWT_SECRET`. Token lifetime comes from `JWT_EXPIRES_IN`.
- The `authenticate` middleware verifies the token on every protected route. It accepts only the expected signing algorithm.
- A missing, malformed, or invalid token returns `401`.
- The frontend attaches the token to API calls and sends the user to the login page on `401`.

## Tenant isolation

- `companyId` comes only from the verified token (`req.user.companyId`). It is never read from the request body, the URL, or the query string.
- Every query on company data includes `companyId` in its `where` clause. Service functions take `companyId` as a required parameter. No unscoped invoice query may exist.
- Another company's invoice returns `404`, not `403`, so invoice IDs are not revealed.
- The Bruno tenant isolation requests check this by hand. Add automated tests that cover it.

## Roles and onboarding

- Role permissions for `admin` and `member` are not decided. Do not assume either role's permissions.
- How the first admin of a company is created is not decided.

## Join codes (planned)

These rules apply when join codes are built. They are not in the schema yet.

- Store a join code only as a slow hash (bcrypt or similar). Show the plain code once, at creation.
- A join code expires 7 days after generation. An expired code gets the same generic error as a wrong code.
- Sign-up returns one generic error for an unknown company and for an invalid code, so company existence is not revealed.
- Rate limit join-code attempts.
- Rotating a join code is a one-off script. It prints the new code once and stores only its hash and new expiry.

## HTTP hardening

- Use `helmet` on the API. It is not installed yet.
- CORS uses an allowlist read from config. In production the allowlist holds only the frontend origin. Do not use `cors()` with no options.
- Rate limit the auth endpoints and the write endpoints. The global limiter is already in place.
- Set an explicit body size limit in `express.json()`.

## Input and output

- Validate every request body, query, and path parameter with Zod.
- Never return stack traces, database errors, SQL text, constraint names, or government response bodies to clients. See `error-handling.md`.
- Database constraints (the unique key on company and invoice number, enum types, decimal types) are the last line of defense, not the only validation.

## Dependencies

- Run `npm audit` in `backend/` and `frontend/` before submission. Fix high and critical findings.
