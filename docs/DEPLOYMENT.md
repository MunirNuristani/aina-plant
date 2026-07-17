# Deploying the backend

How to put `backend/` on the public internet for **$0/month**, so it's reachable
from anywhere instead of only your LAN. This is a prerequisite for building a
frontend against it (and for your ESP32 devices to report in from wherever
they physically live, not just while sitting on your home Wi-Fi).

## Chosen stack

| Piece | Service | Why |
| --- | --- | --- |
| App hosting | [Render](https://render.com), free Web Service | Git-push deploys, no CLI needed, dashboard-driven env vars, free HTTPS on a `*.onrender.com` subdomain |
| Database | [Neon](https://neon.tech), free Postgres | Doesn't expire after 90 days (Render's own free Postgres does), generous free tier, standard `postgres://` connection string Prisma already expects |

Both are genuinely free at this project's scale — no credit card required for
either as of writing. Total cost: **$0/month**.

### The trade-off you're accepting

Render's free tier spins the container down after 15 minutes of no incoming
requests. The next request pays a ~30-60s cold-start penalty while it spins
back up. Two things make this a non-issue here rather than a real problem:

1. **Firmware already retries.** `ReadingRetrier` resubmits a reading (using
   its stable `readingId`) until it succeeds, and the backend's duplicate
   handling (`POST /api/v1/readings` returning `200 duplicate` for an
   already-seen `readingId`) makes retries safe. A reading that hits a cold
   container just takes longer to land — it doesn't get lost or double-counted.
2. **Your reporting interval is 900s by default** (`reportingIntervalSeconds`
   on `Device`) — far longer than the cold-start window, so devices aren't
   hammering it fast enough to notice.

If this ever stops being acceptable (e.g. a frontend user is sitting there
waiting on a slow first load), Render's paid Starter plan ($7/mo) removes the
idle spin-down with no migration needed — same platform, same config, just a
plan upgrade.

## Important: this requires a firmware change too

Render (and every other PaaS free tier) only exposes **HTTPS** on the public
internet — there is no plain-HTTP port your ESP32 can reach once the backend
is off your LAN. Today, `ReadingSubmitter` deliberately only speaks plain
HTTP (see the comment at the top of
`firmware/lib/ReadingSubmitter/ReadingSubmitter.h` — HTTPS was explicitly
called out as out of scope when that module was built). So "deploy the
backend" also means teaching the firmware to speak TLS. That's covered in
[Part 4](#part-4-update-the-firmware-to-speak-https) below — it's a small
change, not a redesign.

Until you're ready to do that, the deployed backend is still useful: you can
develop the frontend against it, hit it with curl/Postman, and keep running
firmware against your local backend as before. The two aren't coupled.

---

## Part 1: Free Postgres on Neon

1. Sign up at [neon.tech](https://neon.tech) (GitHub login works).
2. Create a new project — any name, pick a region close to you.
3. On the project dashboard, copy the **connection string** shown for the
   default database. It looks like:

   ```text
   postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require
   ```

4. Keep `?sslmode=require` in the URL — Neon requires TLS for all
   connections, and Prisma's `DATABASE_URL` needs that query param to connect
   successfully. This is the only difference from your local
   `docker-compose.yml` Postgres, which doesn't need it.
5. That's it — no manual database/table creation. `prisma migrate deploy`
   (Part 2) creates the schema for you.

## Part 2: Deploy the app to Render

1. Push your latest code to GitHub if you haven't already (Render deploys
   from a GitHub repo).
2. At [render.com](https://render.com), **New +** → **Web Service** → connect
   your `aina-plant` repo.
3. Configure the service:

   | Field | Value |
   | --- | --- |
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run build` |
   | Start Command | `npm run prisma:migrate:deploy && npm start` |
   | Instance Type | Free |

   Running `prisma migrate deploy` as part of the start command (rather than
   a separate manual step) means every deploy — including your very first
   one — applies any pending migrations before the server starts serving
   traffic. It's idempotent: if there's nothing new to apply, it's a no-op.

   **About `--include=dev`:** Render sets `NODE_ENV=production` for the
   whole service, build included (you're setting it yourself below anyway,
   for the app's own logging/error behavior at runtime). npm treats
   `NODE_ENV=production` as a signal to skip `devDependencies` — but
   `typescript` and the `@types/*` packages this project's `tsc` build
   needs are all in `devDependencies`. Without `--include=dev`, the build
   step is missing type declarations it needs (you'll see errors like
   `Could not find a declaration file for module 'express'`) — some
   devDependencies may still work by accident, hoisted in transitively by
   an unrelated production package (e.g. `@types/node` via Prisma's own
   tree), which is why the failure can look inconsistent rather than
   "nothing works." `--include=dev` forces npm to install them regardless
   of `NODE_ENV`, so the build always has what it needs.

4. Add environment variables (Render's dashboard, under the service's
   **Environment** tab):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string from Part 1 |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | output of `openssl rand -base64 32` |
   | `AI_API_KEY` | any placeholder string for now — see note below |
   | `LOG_LEVEL` | `info` |

   `JWT_SECRET` and `AI_API_KEY` are required by `src/config/schema.ts` (the
   app won't boot without them) but aren't actually read anywhere in the
   codebase yet — they're placeholders for auth and AI-recommendation
   features that don't exist yet. Any value that satisfies the schema
   (32+ chars for `JWT_SECRET`, non-empty for `AI_API_KEY`) is fine until
   those features are built, at which point you'll replace them with real
   secrets.

5. Under **Settings → Health Check Path**, set it to `/api/v1/health`. Render
   uses this to know the deploy actually succeeded and to detect if the app
   goes unhealthy later.
6. Click **Create Web Service**. First deploy takes a few minutes (installs
   deps, runs `tsc`, runs migrations, starts the server). Render gives you a
   URL like `https://aina-plant-backend.onrender.com`.

## Part 3: Verify it

```bash
curl https://<your-app>.onrender.com/api/v1/health
# {"status":"healthy","database":"healthy","requestId":"..."}
```

Then run the seed script once against production to get a usable test
device and plant (same script you already use locally, just pointed at the
Neon URL):

```bash
cd backend
DATABASE_URL="<neon-connection-string>" npx tsx prisma/seed.ts
```

Or skip seeding and register a real device directly:

```bash
curl -X POST https://<your-app>.onrender.com/api/v1/devices \
  -H 'Content-Type: application/json' \
  -d '{"name":"My ESP32","identifier":"esp32-001"}'
```

Update the `baseUrl` collection variable in
`docs/aina-plant-backend.postman_collection.json` to your Render URL and
run through it if you want a fuller smoke test.

## Part 4: Update the firmware to speak HTTPS

`ReadingSubmitter` currently uses a plain `HTTPClient` bound to a
`WiFiClient`, which can only do unencrypted `http://`. To reach a Render
URL you need `WiFiClientSecure` instead. The simplest viable change for a
hobby project:

```cpp
// ReadingSubmitter.cpp
#include <WiFiClientSecure.h>

// ... inside submit():
WiFiClientSecure client;
client.setInsecure();  // skip certificate validation -- see note below
HTTPClient http;
http.begin(client, apiUrl_);
```

`setInsecure()` skips TLS certificate verification — the connection is still
encrypted, but the ESP32 won't check that it's really talking to your
server and not an impersonator on the network path. That's an accepted
trade-off for a personal plant-monitoring device with no sensitive data
beyond a device credential (which the backend can revoke via
`rotate-credential` if you're ever worried it leaked). If you want real
certificate pinning later, `WiFiClientSecure::setCACert()` with Render's
CA certificate is the upgrade path — not needed to get started.

Then update `main.cpp`:

```cpp
// Before (LAN-only):
constexpr const char* API_URL = "http://YOUR_LAN_IP:3000/api/v1/readings";

// After (deployed):
constexpr const char* API_URL = "https://<your-app>.onrender.com/api/v1/readings";
```

And swap `DEVICE_IDENTIFIER`/`DEVICE_KEY` from the seed fixture values to the
credential you got back from registering a real device in Part 3 — the seed
device is a shared dev-only fixture, not meant for a real deployed device.

I haven't made these firmware edits yet — say the word when you want me to
wire this up for real, since it also means updating
`firmware/README.md`'s "Local network address setup" section, which
currently documents the LAN-only setup as the only option.

## Part 5: Future deploys

Once this is set up, shipping a backend change is just:

```bash
git push origin main
```

Render watches the repo and redeploys automatically. Any new Prisma
migration you've committed under `prisma/migrations/` gets applied
automatically too, since `prisma migrate deploy` runs as part of the start
command on every deploy.

## Limits worth knowing about

- **Render free tier**: 750 instance-hours/month shared across all your free
  services. Since the container scales to zero when idle, a single
  low-traffic personal service like this essentially never gets close to
  that limit.
- **Neon free tier**: generous storage/compute allowance for a project this
  size; Neon's own dashboard shows current usage if you want to keep an eye
  on it. No 90-day expiry, unlike Render's bundled free Postgres.

If you ever outgrow either free tier, both offer paid plans on the same
platform — no re-platforming required, just a plan change.
