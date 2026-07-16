# Backend

Express + TypeScript API for the aina-plant platform.

## Quickstart

A complete, copy-pasteable walkthrough from a clean clone to submitting and
retrieving a real sensor reading. Every command below was run start-to-finish
against a freshly wiped database to confirm it actually works.

### 1. Prerequisites

- Node.js 20+
- Docker (for the local PostgreSQL database)

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

`.env.example`'s defaults work out of the box — no edits needed. See
"Environment variables" below for what each one does; none of them are
real credentials.

### 3. Start PostgreSQL

```bash
npm run db:up
```

Give it a few seconds to become healthy: `docker compose ps` should show
`(healthy)` next to `aina-plant-postgres`.

### 4. Run migrations

```bash
npm run prisma:migrate
```

Applies every migration in `prisma/migrations/` — the Docker volume starts
completely empty, so all of them run.

### 5. Seed sample data

```bash
npm run prisma:seed
```

Creates one plant, one device (assigned to that plant), and one sample
reading, and prints a development-only device credential to the console.
The walkthrough below uses the seed script's fixed values directly, so you
don't need to copy anything from its output unless you changed them.

### 6. Start the backend

```bash
npm run dev
```

Leave this running in its own terminal. It validates your `.env` and
confirms the database connection before it starts listening — if either
fails, it prints a clear error and exits instead of starting broken (see
"Troubleshooting" below). If port `3000` is already in use by something
else on your machine, run `PORT=3001 npm run dev` instead and adjust the
port in the commands below to match.

### 7. Submit a sample reading

Authenticate as the seeded device to get its internal `id` (distinct from
its `identifier`):

```bash
curl -X POST http://localhost:3000/devices/auth \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"dev-seed-device-001","credential":"dev-only-seed-credential-do-not-use-in-production"}'
```

The response looks like `{"device":{"id":"<uuid>","identifier":"dev-seed-device-001",...}}`
— copy that `id`, then submit a reading with it:

```bash
DEVICE_ID=<paste the id from above>

curl -X POST http://localhost:3000/api/v1/readings \
  -H 'Content-Type: application/json' \
  -H 'X-Device-Id: dev-seed-device-001' \
  -H 'X-Device-Key: dev-only-seed-credential-do-not-use-in-production' \
  -d "{\"readingId\":\"$(node -e 'console.log(require("crypto").randomUUID())')\",\"deviceId\":\"$DEVICE_ID\",\"recordedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"rawMoisture\":2048,\"moisturePercent\":45.5}"
```

A successful submission returns `201` with
`{"readingId": "...", "status": "created", "recordedAt": "...", "receivedAt": "..."}`.

### 8. Retrieve it back

```bash
curl http://localhost:3000/api/v1/plants/00000000-0000-0000-0000-000000000001/readings/latest
```

`00000000-0000-0000-0000-000000000001` is the seed plant's fixed ID. The
response should be the reading you just submitted.

If any step didn't work as described, see "Troubleshooting" near the
bottom of this file.

## Environment variables

All read and validated at startup (`src/config/schema.ts`) — the app
refuses to start if a required one is missing or malformed, with a clear
error naming exactly which variable and why. Full details and generation
tips are in `.env.example`.

| Variable       | Required | Default       | Purpose                                                       |
| -------------- | -------- | ------------- | ------------------------------------------------------------- |
| `NODE_ENV`     | No       | `development` | `development` \| `test` \| `production`.                      |
| `PORT`         | No       | `3000`        | HTTP port the server listens on.                              |
| `DATABASE_URL` | Yes      | —             | Postgres connection string.                                   |
| `JWT_SECRET`   | Yes      | —             | Signs/verifies JWTs; min. 32 characters.                      |
| `AI_API_KEY`   | Yes      | —             | API key for the AI recommendation provider.                   |
| `LOG_LEVEL`    | No       | `info`        | `trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`\|`silent`. |

None of these need to be real/production credentials for local development
or for running the test suite — `.env.example`'s placeholder values (or any
string satisfying the same format/length rules) work fine.

## Database

The local development database runs in Docker.

Start it:

```bash
npm run db:up
```

Stop it (data persists in a Docker volume):

```bash
npm run db:down
```

Stop it and wipe all data:

```bash
npm run db:down:volumes
```

Tail the database logs:

```bash
npm run db:logs
```

## Prisma

The app talks to Postgres through [Prisma](https://www.prisma.io/), using
`DATABASE_URL` from your `.env` — no credentials are hardcoded anywhere in
the schema or config.

```bash
npm run prisma:generate       # regenerate the client from prisma/schema.prisma
npm run prisma:migrate        # create + apply a migration in development
npm run prisma:migrate:deploy # apply pending migrations (CI / production)
npm run prisma:studio         # browse the database in Prisma Studio
```

The client is regenerated automatically after `npm install` (via
`postinstall`), and its output (`src/generated/prisma`) is gitignored — never
commit it, just regenerate it.

Import the shared client from `src/db`:

```ts
import { prisma } from './db';

const rows = await prisma.$queryRaw`SELECT 1`;
```

### Seeding

```bash
npm run prisma:seed
```

Creates one test plant, one test device (assigned to that plant), and one
sample sensor reading. Safe to run repeatedly — it upserts by fixed IDs /
the device's unique identifier, so it won't create duplicates.

The seeded device's credential is fixed and printed to the console every
time you seed — it's for local testing only and is clearly labeled
`DEVELOPMENT CREDENTIAL — DO NOT USE IN PRODUCTION`. Test it against a
running server with the `curl` command the seed script prints, e.g.:

```bash
curl -X POST http://localhost:3000/devices/auth -H 'Content-Type: application/json' \
  -d '{"identifier":"dev-seed-device-001","credential":"dev-only-seed-credential-do-not-use-in-production"}'
```

## Request IDs

Every request gets a correlation ID via `requestIdMiddleware`
(`src/middleware/request-id.ts`), the first middleware in the stack:

- Reads `X-Request-Id` from the incoming request. If it's not a
  well-formed UUID (wrong shape or length), a fresh one is generated
  instead — a client can never inject an arbitrary or oversized value into
  logs or responses.
- Otherwise generates a new UUID.
- Echoes it back on every response via the same `X-Request-Id` header.
- Includes it in every JSON error body as `error.requestId` (400/401/403/404/409/500).

The ID is also available to code that has no access to `req` at all — e.g.
`device-service.ts`'s auth-rejection logging — via `getRequestId()`
(`src/lib/request-context.ts`), backed by Node's `AsyncLocalStorage`. Use
the shared `logger` (see "Logging" below) instead of calling `console.*`
directly anywhere in a request's code path, and the current request ID is
attached to the log line automatically as a `requestId` field.

Two requests sharing the same ID (whether by client mistake or by design)
never interfere with each other — `AsyncLocalStorage` scopes by the actual
async call graph of each request, not by the ID value itself.

## Logging

The app uses [pino](https://getpino.io/) (`src/lib/logger.ts`) for
structured (JSON) logging, exported as a shared `logger` singleton. Always
log through it — never call `console.*` directly in application code — so
every line gets request-ID attribution and redaction consistently.

```bash
LOG_LEVEL=debug npm run dev   # more verbose than the "info" default
```

`LOG_LEVEL` (env var, see `.env.example`) sets the minimum level emitted:
`trace | debug | info | warn | error | fatal | silent`. Defaults to `info`.

Output is always raw JSON, even in development — there's no in-process
"pretty" transport, since pino's transports run in a separate worker
thread, which would make output impossible to intercept in tests and adds
complexity for little benefit. For readable local output, pipe it through
`pino-pretty` (already a dev dependency):

```bash
npm run dev | npx pino-pretty
```

**What's logged today** (all via the shared `logger`):

| Event                                                            | Where                                            | Level   |
| ---------------------------------------------------------------- | ------------------------------------------------ | ------- |
| Device auth rejected (missing headers, bad credential, disabled) | `device-auth.ts` middleware, `device-service.ts` | `warn`  |
| Reading payload failed validation                                | `routes/readings.ts`                             | `warn`  |
| Reading ingested successfully                                    | `services/reading-service.ts`                    | `info`  |
| Duplicate reading ignored (retry or concurrent race)             | `services/reading-service.ts`                    | `info`  |
| Reading ingestion failed for a non-duplicate database error      | `services/reading-service.ts`                    | `error` |
| Startup database connectivity failure                            | `db/index.ts`                                    | `fatal` |
| Unhandled error reaching the top-level error handler             | `app.ts`                                         | `error` |

**Redaction**: `credential`, `credentialHash`, and `key` fields (at the top
level or one level nested) are replaced with `[Redacted]` before output,
regardless of where in the object they appear — this is a safety net in
addition to the existing discipline of never passing a raw secret to a log
call in the first place (see `device-service.ts`'s `authenticateDevice`).
`DATABASE_URL`'s password is masked separately, before it ever reaches the
logger (see `db/index.ts`), since it needs to show the rest of the
connection string rather than be fully redacted.

## Errors

Every error response — expected or not — has the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "...", "details": [...] } }
```

`details` is only present when the error provides it. `code` is a stable,
machine-readable identifier — prefer branching on it over the HTTP status
alone, since a status like `409` can mean more than one thing depending on
the endpoint.

Application code throws one of the typed errors in `src/http/errors.ts`
(each declares its own `statusCode` and `code`):

| Error               | Status | Code               |
| ------------------- | ------ | ------------------ |
| `ValidationError`   | 400    | `VALIDATION_ERROR` |
| `UnauthorizedError` | 401    | `UNAUTHORIZED`     |
| `ForbiddenError`    | 403    | `FORBIDDEN`        |
| `NotFoundError`     | 404    | `NOT_FOUND`        |
| `ConflictError`     | 409    | `CONFLICT`         |

`errorHandler` (`src/middleware/error-handler.ts`, registered last in
`app.ts`) turns these into the response above. Anything else — a plain
`Error`, a Prisma error, whatever — is treated as unexpected: the client
gets a generic `500 INTERNAL_ERROR` with no message or stack trace from the
original error, while the full error (including its stack) goes to
`logger.error`, keyed by `requestId` for correlation.

**Field-level errors** (`ValidationError`'s `details`) use a stable
`{ field, message }` shape — call `toFieldErrors(zodError.issues)` rather
than passing Zod's own issues straight through. This decouples the public
API contract from Zod's internal issue format, which has already changed
shape once across a major version in this project. (Log statements that
also want the raw Zod issues, e.g. for debugging, can still log them
directly — only the client-facing `details` needs the stable shape.)

## Health check

`GET /health` reports whether the app and its database dependency are up —
point a load balancer / orchestrator health probe at it. Unauthenticated,
read-only (a single `SELECT 1`, via `isDatabaseHealthy()` in `src/db/index.ts`).

```json
{ "status": "healthy", "database": "healthy", "requestId": "..." }
```

| Status | Body                               |
| ------ | ---------------------------------- |
| `200`  | `status`/`database`: `"healthy"`   |
| `503`  | `status`/`database`: `"unhealthy"` |

On failure, the response never includes the connection string, the
underlying error message, or a stack trace — those go only to
`logger.error`, correlated by `requestId`. This is deliberately a separate
code path from `verifyDatabaseConnection()` (the startup check, which
exits the process on failure): a failed health check should make an
already-running instance report unhealthy, not crash it.

## Device authentication

Routes that a device itself calls (e.g. reading ingestion, below) are
protected by `deviceAuthMiddleware` (`src/middleware/device-auth.ts`), which
expects two headers:

```text
X-Device-Id: <device identifier>
X-Device-Key: <device credential, plaintext>
```

It looks up the device by `X-Device-Id`, verifies `X-Device-Key` against the
stored credential hash, and rejects with `401` if either header is missing
or the credential is wrong, `403` if the device exists but is disabled. On
success it attaches the device to `req.device` for downstream handlers.
Failed attempts are logged (identifier + reason only — the credential itself
is never logged).

This is distinct from `POST /devices/auth` (JSON body, used for manual
checks like the seed script's curl example above) — the middleware is what
real protected routes should use.

## Reading ingestion

`POST /api/v1/readings` is how a device submits a sensor reading. It's
protected by `deviceAuthMiddleware` (see above) and validated against
`sensorReadingSchema` (`src/validation/reading.ts`) — see that file for the
exact field rules (ranges, formats, etc.).

**Responses:**

| Status | Meaning                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `201`  | New reading stored. Body: `{ "readingId": "...", "status": "created", "recordedAt": "...", "receivedAt": "..." }`                      |
| `200`  | Same `readingId` already stored for this device — see "Retries and duplicates" below. Same body shape, `status: "duplicate"`.          |
| `400`  | Payload failed validation, or its `deviceId` doesn't match the authenticated device. See "Errors" above for the `error.details` shape. |
| `401`  | Missing or invalid `X-Device-Id` / `X-Device-Key`.                                                                                     |
| `403`  | Device exists and credentials are valid, but it's disabled.                                                                            |
| `409`  | The device isn't assigned to a plant, or `readingId` is already in use by a **different** device.                                      |

`recordedAt` is the device-supplied measurement time, preserved exactly as
submitted. `receivedAt` is generated by the server at ingestion time and can
never be set by the client — any `receivedAt` in the request body is
silently ignored. Both are stored as `timestamptz` (UTC) and always returned
as `Z`-suffixed ISO 8601 strings. The gap between the two tells you whether
a reading arrived in real time or was buffered by the device and submitted
later (e.g. after a Wi-Fi outage).

### Retries and duplicates

`readingId` is generated by the device (a UUID) and doubles as an
idempotency key. A device that times out waiting for a response and retries
should **resend the exact same `readingId`** — not generate a new one — so
the server can recognize the retry:

- Same `readingId`, same device, already stored → the request is treated as
  a no-op success: no new row is written, the response is `200` with
  `status: "duplicate"`, and it always echoes back the original
  `readingId`. This holds even if two retries race each other concurrently.
- Same `readingId`, but claimed by a **different** device than the one that
  originally stored it → rejected with `409` and the original record is left
  completely untouched. A `readingId` can never be used to overwrite another
  device's reading.

### Device simulator

`scripts/simulate-device.ts` exercises the full ingestion pipeline —
authenticate, submit a reading, optionally replay it, retrieve it back —
without needing a physical ESP32.

```bash
npm run simulate                    # authenticate, submit one reading, retrieve it back
npm run simulate -- --replay        # also resubmit the same reading (expect status: "duplicate")
npm run simulate -- --reading-id <uuid>              # reuse a specific reading ID
npm run simulate -- --raw-moisture 3000 --moisture-percent 80.5  # override the sensor values
```

Configuration is read from environment variables, never hardcoded:

| Variable               | Default                                              |
| ---------------------- | ---------------------------------------------------- |
| `SIMULATOR_API_URL`    | `http://localhost:3000`                              |
| `SIMULATOR_DEVICE_ID`  | `dev-seed-device-001` (the seed device's identifier) |
| `SIMULATOR_DEVICE_KEY` | the seed device's dev-only credential                |

The defaults point at the seeded device (see "Seeding" above) purely for
convenience — that credential is already documented everywhere else in this
README as development-only, never a real secret. Point the script at a real
device by overriding all three, e.g.:

```bash
SIMULATOR_API_URL=https://staging.example.com \
SIMULATOR_DEVICE_ID=my-real-device \
SIMULATOR_DEVICE_KEY=the-real-credential \
npm run simulate
```

The script prints the request it sent and the full JSON response at every
step, and exits with a nonzero status if authentication or submission
fails — safe to use in a shell script or CI smoke test.

## Latest reading

`GET /api/v1/plants/:plantId/readings/latest` is how the dashboard fetches a
plant's current state. Unauthenticated — this is a dashboard/admin-facing
read endpoint, not a device-facing one, and there's no user/admin auth
system in this project yet.

"Newest" means most recently **measured** (`recordedAt`), not most recently
received — a buffered reading that arrives late with an old `recordedAt`
won't shadow a genuinely more recent one.

| Status | Meaning                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| `200`  | `{ "reading": {...} }` — full row, including `rawMoisture`, `moisturePercent`, `recordedAt`, `receivedAt`. |
| `200`  | `{ "reading": null }` — plant exists, has no readings yet. Not an error.                                   |
| `404`  | Plant does not exist.                                                                                      |

## Reading history

`GET /api/v1/plants/:plantId/readings` returns a time-range slice of a
plant's readings, for charts and inspection. Same auth posture as "Latest
reading" above (unauthenticated, dashboard-facing). Query parameters (all
optional):

| Param   | Default | Meaning                                                                    |
| ------- | ------- | -------------------------------------------------------------------------- |
| `start` | —       | ISO 8601 UTC timestamp. Only readings with `recordedAt >= start`.          |
| `end`   | —       | ISO 8601 UTC timestamp. Only readings with `recordedAt <= end`.            |
| `sort`  | `asc`   | `asc` (oldest first, for charts) or `desc` (newest first, for inspection). |
| `limit` | `100`   | Max rows returned. Rejected with `400` if above `1000`.                    |

`start`/`end` can be used independently for an open-ended range. Supplying
`start` after `end` is rejected with `400`. A plant with no readings in the
requested range returns `{ "readings": [] }` — not an error. Each item has
the same shape as "Latest reading" above (raw + calibrated values, both
timestamps).

## Recent activity (admin)

`GET /api/v1/readings/recent` is a global (not plant-scoped) feed of the
most recent pipeline activity, for an administrator inspecting what's
coming through without querying the database directly. Same auth posture as
the other read endpoints (unauthenticated, admin-facing).

Ordered by **`receivedAt`** descending — not `recordedAt`. This is
deliberately different from "Latest reading" / "Reading history" above:
this view answers "what has the pipeline processed lately," so a reading
that was measured a while ago but just arrived (e.g. a device catching up
after a Wi-Fi outage) correctly shows up as recent activity here, even
though it wouldn't be the "latest" measurement for its plant.

Each item includes `deviceId`/`plantId` plus a joined `device.identifier`
and `plant.name`, so entries are identifiable without a separate lookup.

Query params: `limit` (default `50`, rejected with `400` above `500` — a
smaller default and cap than "Reading history," since this is a quick
glance, not chart data).

There's no separate "rejected submissions" log: a payload that fails
validation is never persisted, so it can never appear here — nothing
additional needs to be filtered out.

## Running the app

```bash
npm run dev     # development, auto-restarts on file changes
npm run build   # type-checks and compiles to dist/
npm start       # runs the compiled build (dist/server.js)
```

On startup the app validates its environment configuration and verifies it
can connect to the database before it starts listening. If either check
fails, it prints a clear error and exits instead of starting in a broken
state.

## Linting and formatting

```bash
npm run lint
npm run format
```

## Testing

Tests use [Vitest](https://vitest.dev/), configured in `vitest.config.ts`.

```bash
npm test         # run once — exits nonzero if anything fails, safe for CI
npm run test:watch
```

**No production credentials are ever needed.** Tests use the same `.env`
as local development (copied from `.env.example`, see "Setup" above) —
just the local Docker Postgres credentials and any string that satisfies
the format checks for `JWT_SECRET`/`AI_API_KEY`. Nothing talks to a real
external service.

Most tests exercise real HTTP routes and Postgres queries end-to-end (no
mocking), so `npm run db:up` needs to be running first. Each such test
creates its own uniquely-identified rows and cleans them up afterward, so
it's safe to run alongside seeded or manually-created data. Some tests need
no database at all — e.g. `src/lib/device-credential.test.ts` is a
self-contained example covering pure functions with zero setup; try
running just that file with Postgres stopped to see the difference:

```bash
npm run db:down
npx vitest run src/lib/device-credential.test.ts
```

## Troubleshooting

**"Invalid environment configuration" at startup**
The app validates every variable in `.env` before it will start (see
"Environment variables" above) and names exactly which one is missing or
malformed. Compare your `.env` against `.env.example` — most often this is
a forgotten `cp .env.example .env`, or `JWT_SECRET` shorter than 32
characters.

**Port `3000` already in use (or the server seems to start but requests
fail strangely)**
Something else on your machine — another project, another instance of this
one, even an unrelated Docker container — may already be bound to the
port. Run `PORT=3001 npm run dev` (or any free port) instead, and use that
port in place of `3000` in every command in "Quickstart" above.

**Seeding fails with a "table does not exist" / Prisma error**
Migrations haven't been applied yet. Run `npm run prisma:migrate` before
`npm run prisma:seed` — a freshly created database (or one just wiped with
`npm run db:down:volumes`) has no tables at all until migrations run.

**`POST /api/v1/readings` returns 401/403 during the Quickstart walkthrough**
Double check you're sending both `X-Device-Id: dev-seed-device-001` and
`X-Device-Key: dev-only-seed-credential-do-not-use-in-production` exactly
as printed by `npm run prisma:seed` — a 401 means the identifier or key
didn't match, a 403 means the device exists but is disabled (shouldn't
happen with a freshly seeded device; re-run the seed command to reset it).

### Database connectivity

**`ECONNREFUSED` / "Failed to connect to the database"**
Postgres isn't running or isn't reachable yet. Run `npm run db:up`, then check
`npm run db:logs` — a fresh container needs a few seconds to become ready.

**`password authentication failed for user "..."`**
The credentials in `DATABASE_URL` (in your `.env`) don't match the
`POSTGRES_USER` / `POSTGRES_PASSWORD` the container was started with. Either
reset both back to the `.env.example` defaults, or export matching
`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` variables before running
`npm run db:up` so the container and `DATABASE_URL` agree. This error also
shows up if `DATABASE_URL` is still pointing at port `5432` and you have a
local (non-Docker) Postgres install answering on that port instead of the
project's container — see the port note below.

**`database "..." does not exist`**
The database name in `DATABASE_URL` doesn't match `POSTGRES_DB`. Same fix as
above — keep them in sync.

**Port `5433` already in use, or `DATABASE_URL` connecting to the wrong Postgres**
The container's host port defaults to `5433` (not the standard `5432`)
specifically so it doesn't collide with a Postgres server you might already
have running locally. If `5433` is also taken, or you'd rather use a
different port, set `POSTGRES_PORT` before running `npm run db:up` and update
the port in `DATABASE_URL` to match.

**Docker daemon not running**
`docker compose up` will fail immediately with a connection error to the
Docker socket. Start Docker Desktop (or your Docker daemon) and retry.
