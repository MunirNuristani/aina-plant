# Frontend

Next.js (App Router) + TypeScript + Tailwind CSS dashboard for the
aina-plant platform.

## Quickstart

### 1. Prerequisites

- Node.js 20+
- The [backend](../backend) running locally (or any reachable instance) if
  you want the app to talk to real data — the app itself starts fine
  without it, since nothing on this foundation page fetches data yet.

### 2. Install and configure

```bash
npm install
cp .env.example .env.local
```

`.env.example`'s default (`http://localhost:3000/api/v1`) matches the
backend's default port. See "Environment variables" below.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (Next.js picks the next
free port, e.g. `3001`, if the backend or something else is already on
`3000` — check the terminal output for the actual URL).

## Environment variables

Read via `src/lib/env.ts`, which throws immediately at startup if a
required variable is missing or malformed, rather than failing later with
an unclear error.

| Variable              | Required | Default | Purpose                                                        |
| ---------------------- | -------- | ------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Yes      | —       | Base URL of the backend API, no trailing slash. See `.env.example`. |

`NEXT_PUBLIC_`-prefixed variables are inlined into the browser bundle at
build time (see [Next.js docs](https://nextjs.org/docs/app/guides/environment-variables))
— don't put secrets in one, since anything served to the dashboard is
public by definition anyway.

`.env.local` is gitignored, like the backend's `.env`. `.env.example` is
committed and kept up to date as the source of truth for what's needed.

## API base URL handling

`src/lib/env.ts` exposes the validated `env.apiUrl`. `src/lib/api.ts`
builds on it:

```ts
import { apiUrl, apiFetch } from "@/lib/api";

apiUrl("/plants/123/readings/latest");
// => `${NEXT_PUBLIC_API_URL}/plants/123/readings/latest`

const res = await apiFetch("/plants/123/readings/latest");
```

See [`../docs/API.md`](../docs/API.md) for the endpoints exposed by the
backend.

## Running the app

```bash
npm run dev     # development, hot reload
npm run build   # type-checks and produces a production build
npm start       # runs the production build (run `npm run build` first)
```

## Linting

```bash
npm run lint
```
