# Backend

Express + TypeScript API for the aina-plant platform.

## Prerequisites

- Node.js 20+
- Docker (for the local PostgreSQL database)

## Setup

```bash
npm install
cp .env.example .env
```

The defaults in `.env.example` already match the local database started by
`docker-compose.yml`, so no edits are required to get running.

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

## Troubleshooting database connectivity

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
