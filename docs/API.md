# API Reference

Every HTTP endpoint currently implemented by `backend/`. This is a
reference — "how do I call this endpoint" — not a narrative guide;
for setup, local development, and deeper walkthroughs (retries, the
device simulator, seeding), see `backend/README.md`.

**Versioning**: this document is checked into git alongside the code it
describes and must be updated in the same PR as any change to a route,
schema, or response shape — a stale example here is worse than none. It
reflects the API exactly as implemented as of the commit it's part of; if
an example stops matching reality, that's a bug in this file. Every
endpoint in this document lives under the `/api/v1/` prefix — there is no
unversioned surface.

## Conventions

### Base URL

Local development: `http://localhost:3000` (the port is configurable —
see `backend/README.md`'s "Environment variables"). There is no deployed
production base URL yet.

### Authentication

Two independent authentication schemes exist, for two different kinds of
caller — a device authenticates itself once per reading submission; a
human authenticates once (at login) and reuses that token for everything
else:

- **Device authentication** (`X-Device-Id` / `X-Device-Key` headers) —
  used by `POST /api/v1/readings`, the one endpoint an ESP32 device
  itself calls. See "Device authentication" below.
- **User authentication** (`Authorization: Bearer <token>`) — used by
  every device-management endpoint (`POST /api/v1/devices`,
  `PATCH /api/v1/devices/:id`, `POST /api/v1/devices/:id/rotate-credential`,
  `POST /api/v1/devices/:id/assign`), every endpoint under
  `/api/v1/plants/*`, and `GET /api/v1/readings/recent`. See "User
  authentication" below. `POST /api/v1/devices/auth` (a device's own
  self-auth check) is the one exception under `/devices` — it needs
  neither scheme.
- **No authentication** — `GET /api/v1/health`, `POST /api/v1/auth/signup`,
  `POST /api/v1/auth/login`, and `POST /api/v1/devices/auth`.

Every plant and device is owned by exactly one user (see the `userId`
field on both in the response bodies below). A caller only ever sees
their own plants/devices/readings/care-events — a valid token for a
*different* user's resource gets a `404`, identical to the resource not
existing at all (never a `403`, which would confirm to an attacker that a
guessed ID is real).

#### User authentication

```text
Authorization: Bearer <JWT>
```

Obtain a token via `POST /api/v1/auth/signup` or `POST /api/v1/auth/login`
(see "Auth" below) — both return a `token` alongside the created/found
`user`. The token is a JWT (HS256), currently valid for 30 days; there is
no refresh mechanism yet, and no `/logout` endpoint (it's stateless — a
client just discards the token).

Failure modes: `401` if the header is missing, malformed, or the token is
invalid/expired/signed with the wrong key.

#### Device authentication

Two headers, sent with every request to a device-authenticated endpoint:

```text
X-Device-Id: <device identifier>
X-Device-Key: <device credential, plaintext>
```

- `X-Device-Id` is the device's `identifier` (a human-chosen string set at
  registration) — **not** its `id` (a server-generated UUID used
  elsewhere, e.g. in the reading payload's `deviceId` field; see
  `POST /api/v1/readings` below for why these two are different values).
- `X-Device-Key` is the plaintext credential returned once, at
  registration or rotation (see `POST /api/v1/devices` and
  `POST /api/v1/devices/:id/rotate-credential`) — never stored or logged
  in plaintext server-side.

Failure modes: `401` if either header is missing or the credential is
wrong; `403` if the device exists and the credential is correct, but the
device is disabled.

### Error format

Every error response (any 4xx/5xx) has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid sensor reading payload",
    "requestId": "a1b2c3d4-...",
    "details": [
      { "field": "rawMoisture", "message": "rawMoisture must be a number" }
    ]
  }
}
```

- `code` — a stable machine-readable string. One of `VALIDATION_ERROR`
  (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
  `CONFLICT` (409), `TOO_MANY_REQUESTS` (429, `POST /api/v1/auth/login`
  only — see "Auth" below), or `INTERNAL_ERROR` (500, an
  unexpected/unhandled failure — see "Database failures" below).
- `message` — human-readable, safe to show a developer, not necessarily
  safe to show an end user verbatim.
- `requestId` — echoes the `X-Request-Id` response header (see
  `backend/README.md`'s "Request IDs"); include it when reporting a bug.
- `details` — present only on some errors. For validation failures
  (`VALIDATION_ERROR`), it's always an array of `{ field, message }`
  (`field` is `(root)` for a whole-body error, e.g. "at least one field
  must be provided"). For a small number of `CONFLICT` errors, it's a
  plain object with extra context instead (e.g.
  `POST /api/v1/devices/:id/assign`'s `{ currentPlantId }` — documented
  on that endpoint specifically).

### Database failures

An unhandled server-side failure (e.g. a database constraint violation
that isn't one of the specific, documented `409` cases) never leaks
internal detail to the client — it's logged server-side (with the full
error and a `requestId` for correlation) and the client gets a generic:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "requestId": "..."
  }
}
```

with HTTP status `500`.

---

## Health

### `GET /api/v1/health`

Liveness/readiness check — confirms the server is up and can reach
Postgres. No authentication.

#### Response

| Status | Condition                              |
| ------ | -------------------------------------- |
| `200`  | Server up, database reachable.         |
| `503`  | Server up, database **not** reachable. |

```bash
curl http://localhost:3000/api/v1/health
```

```json
{ "status": "healthy", "database": "healthy", "requestId": "a1b2c3d4-..." }
```

A `503` response has the same shape with `"status"`/`"database"` both
`"unhealthy"` — it is **not** wrapped in the `error` envelope above; this
endpoint always returns a flat body regardless of status.

---

## Auth

Human account creation and login. Open self-signup — no invite or
approval flow. Neither endpoint requires authentication.

### `POST /api/v1/auth/signup`

#### Request body

| Field      | Type   | Required | Notes                                                  |
| ---------- | ------ | :------: | ------------------------------------------------------- |
| `email`    | string |    ✓     | Normalized to lowercase server-side before storage/lookup. |
| `password` | string |    ✓     | Minimum 8 characters. No complexity requirement.       |
| `name`     | string |          | 1–100 characters.                                      |

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email": "person@example.com", "password": "correct-horse-battery", "name": "Person"}'
```

#### `201` response

```json
{
  "user": {
    "id": "0361ffa6-25ef-4285-bfa4-94724c32d1ce",
    "email": "person@example.com",
    "name": "Person",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Errors

| Status | Condition                                    |
| ------ | --------------------------------------------- |
| `400`  | Validation failure (see field table above).   |
| `409`  | `email` is already registered.                |

### `POST /api/v1/auth/login`

Rate-limited (per source IP, in-memory — resets on process restart; not
shared across instances) to guard against credential-stuffing on a
publicly reachable endpoint.

#### Request body

`email` (string, required), `password` (string, required).

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "person@example.com", "password": "correct-horse-battery"}'
```

#### `200` response

Same shape as signup's `201` response: `{ "user": {...}, "token": "..." }`.

#### Errors

| Status | Condition                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------- |
| `401`  | Unknown email, or wrong password — deliberately the same error for both, to avoid confirming which registered emails exist. |
| `429`  | Too many login attempts from this source in the current window.                                 |

---

## Devices

Device registration and management. Every endpoint in this section
except `POST /api/v1/devices/auth` requires **user authentication** (see
"Authentication" above) — a device is created under, and only visible
to, the user that registered it.

### `GET /api/v1/devices`

Lists the authenticated user's own devices, oldest first.

```bash
curl http://localhost:3000/api/v1/devices \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

An array, `[]` if there are none. Each device includes a `plant` field —
`null` if unassigned, otherwise `{ id, name }` for the plant it's
currently assigned to. Never includes `credentialHash`.

```json
{
  "devices": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Balcony ESP32",
      "identifier": "esp32-balcony-01",
      "enabled": true,
      "reportingIntervalSeconds": 900,
      "firmwareVersion": null,
      "lastSeenAt": "2026-01-01T12:00:01.482Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "userId": "0361ffa6-25ef-4285-bfa4-94724c32d1ce",
      "plantId": "9c858901-8a57-4791-81fe-4c455b099bc9",
      "plant": { "id": "9c858901-8a57-4791-81fe-4c455b099bc9", "name": "Balcony Fern" }
    }
  ]
}
```

#### Errors

| Status | Condition                                |
| ------ | ------------------------------------------ |
| `401`  | Missing/invalid `Authorization` header.  |

### `GET /api/v1/devices/:id`

A single device, by `id`. Same shape as one entry of the
`GET /api/v1/devices` array above, wrapped as `{ "device": { ... } }`.

```bash
curl http://localhost:3000/api/v1/devices/3fa85f64-5717-4562-b3fc-2c963f66afa6 \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### Errors

| Status | Condition                                                          |
| ------ | ------------------------------------------------------------------- |
| `401`  | Missing/invalid `Authorization` header.                             |
| `404`  | No device with that `id` belonging to the authenticated user.       |

### `POST /api/v1/devices`

Registers a new device and issues its credential. `FR-DEVICE-001`.

#### Request body

| Field                      | Type   | Required | Notes                                             |
| -------------------------- | ------ | :------: | ------------------------------------------------- |
| `name`                     | string |    ✓     | 1–100 characters.                                 |
| `identifier`               | string |    ✓     | Must be unique across all devices.                |
| `firmwareVersion`          | string |          | Free text.                                        |
| `reportingIntervalSeconds` | number |          | Positive integer. Defaults to `900` (15 minutes). |

```bash
curl -X POST http://localhost:3000/api/v1/devices \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Balcony ESP32", "identifier": "esp32-balcony-01"}'
```

#### `201` response

The plaintext `credential` is returned **exactly once**, here; only its
hash is ever stored. There is no way to retrieve it again later — losing
it means rotating it (see `POST /api/v1/devices/:id/rotate-credential`).

```json
{
  "device": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Balcony ESP32",
    "identifier": "esp32-balcony-01",
    "enabled": true,
    "reportingIntervalSeconds": 900,
    "firmwareVersion": null,
    "lastSeenAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "userId": "0361ffa6-25ef-4285-bfa4-94724c32d1ce",
    "plantId": null
  },
  "credential": "3f9a2b1c...64 hex characters..."
}
```

`userId` is the authenticated caller's own `id` — the device that gets
created is always owned by whoever's token was used.

#### Errors

| Status | Condition                                             |
| ------ | ----------------------------------------------------- |
| `400`  | Validation failure (see field table above).           |
| `401`  | Missing/invalid `Authorization` header.                |
| `409`  | `identifier` is already registered to another device. |

### `PATCH /api/v1/devices/:id`

Updates a device's editable configuration. All fields optional, but at
least one is required.

#### Request body

Any of: `name` (string, 1–100 chars), `firmwareVersion` (string, or
`null` to clear it), `reportingIntervalSeconds` (positive integer),
`enabled` (boolean), `plantId` (the literal value `null` only — **unassigns**
the device from its current plant; see below).

```bash
curl -X PATCH http://localhost:3000/api/v1/devices/3fa85f64-5717-4562-b3fc-2c963f66afa6 \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"reportingIntervalSeconds": 300, "enabled": false}'
```

`plantId` is deliberately **unassign-only** here — it accepts `null` and
nothing else. Assigning a device *to* a specific plant always goes
through `POST /api/v1/devices/:id/assign` (or the plant-centric
`POST /api/v1/plants/:plantId/device`) instead, since only those verify
the target plant belongs to the same user; a non-null `plantId` here is a
`400`, not silently ignored:

```bash
curl -X PATCH http://localhost:3000/api/v1/devices/3fa85f64-5717-4562-b3fc-2c963f66afa6 \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"plantId": null}'
```

#### `200` response

The full updated device (same shape as `POST /api/v1/devices`'s `device`
field, no `credential`).

#### Errors

| Status | Condition                                                                               |
| ------ | --------------------------------------------------------------------------------------- |
| `400`  | Validation failure, or an empty body (`(root)`: "At least one field must be provided"). |
| `401`  | Missing/invalid `Authorization` header.                                                 |
| `404`  | No device with that `id` **belonging to the authenticated user**.                       |

### `POST /api/v1/devices/:id/rotate-credential`

Issues a new credential for an existing device, invalidating the old one
immediately. Identity (`id`, `identifier`), plant assignment, and every
other field are untouched — only the credential changes. Use this instead
of deleting and re-registering a compromised device, which would mint a
new `id` and orphan its reading history's `deviceId` references.

No request body.

```bash
curl -X POST http://localhost:3000/api/v1/devices/3fa85f64-5717-4562-b3fc-2c963f66afa6/rotate-credential \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

Same shape as `POST /api/v1/devices`'s response: the new plaintext
`credential`, returned exactly once, alongside the device.

#### Errors

| Status | Condition                                                          |
| ------ | ------------------------------------------------------------------- |
| `401`  | Missing/invalid `Authorization` header.                             |
| `404`  | No device with that `id` **belonging to the authenticated user**.   |

### `POST /api/v1/devices/:id/assign`

Assigns a device to a plant (device-centric URL — compare
`POST /api/v1/plants/:plantId/device` below, the same operation reached
from the plant's side). `FR-DEVICE-002`.

#### Request body

| Field      | Type    | Required | Notes                                                                                                                     |
| ---------- | ------- | :------: | ------------------------------------------------------------------------------------------------------------------------- |
| `plantId`  | string  |    ✓     | The target plant's `id`.                                                                                                  |
| `reassign` | boolean |          | Default `false`. Required (`true`) to move a device off a **different** plant it's already assigned to — see `409` below. |

```bash
curl -X POST http://localhost:3000/api/v1/devices/3fa85f64-5717-4562-b3fc-2c963f66afa6/assign \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"plantId": "9c858901-8a57-4791-81fe-4c455b099bc9"}'
```

#### `200` response

The full updated device, `plantId` now set.

#### Errors

| Status | Condition                                                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Validation failure.                                                                                                                                                                                                     |
| `401`  | Missing/invalid `Authorization` header.                                                                                                                                                                                 |
| `404`  | No device or no plant with the given ID **belonging to the authenticated user** — both sides are checked, so a real device/plant belonging to someone else 404s the same as a nonexistent one.                        |
| `409`  | Device is disabled, **or** already assigned to a _different_ plant and `reassign` wasn't `true` — the response's `error.details` is `{ "currentPlantId": "..." }` in the latter case (not the usual field-error array). |

Reassigning a device never touches its already-recorded readings — each
reading's `plantId` was captured once at ingestion time, permanently
(see `POST /api/v1/readings` below).

### `POST /api/v1/devices/auth`

Verifies a device identifier + credential pair directly, without
submitting anything. Mainly useful for manual checks/tooling (e.g. the
seed script's printed curl example) — real device-facing endpoints use
the `X-Device-Id`/`X-Device-Key` header scheme instead (see "Device
authentication" above), not this endpoint.

#### Request body

`identifier` (string, required), `credential` (string, required).

```bash
curl -X POST http://localhost:3000/api/v1/devices/auth \
  -H 'Content-Type: application/json' \
  -d '{"identifier": "esp32-balcony-01", "credential": "3f9a2b1c..."}'
```

#### `200` response

`{ "device": { ...same shape as POST /api/v1/devices's device field... } }`

#### Errors

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Validation failure (missing field).             |
| `401`  | Unknown identifier, or wrong credential.        |
| `403`  | Identifier/credential correct, device disabled. |

---

## Readings

### `POST /api/v1/readings`

How a device submits one sensor reading. **Device-authenticated** (see
"Device authentication" above). `FR-READING-001`, `FR-READING-002`.

#### Request body

| Field             | Type    | Required | Notes                                                                                                                                              |
| ----------------- | ------- | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readingId`       | string  |    ✓     | A UUID generated by the device. Doubles as an idempotency key — see "Retries" below.                                                               |
| `deviceId`        | string  |    ✓     | The device's `id` (UUID) — **not** its `identifier`. Must match the authenticated device (see "Device authentication" above for why these differ). |
| `recordedAt`      | string  |    ✓     | ISO 8601 UTC, when the device took the measurement.                                                                                                |
| `rawMoisture`     | integer |    ✓     | 0–4095 (the ESP32's 12-bit ADC range).                                                                                                             |
| `moisturePercent` | number  |    ✓     | 0–100, calibrated.                                                                                                                                 |
| `firmwareVersion` | string  |          | Semver-shaped, e.g. `"1.2.3"`.                                                                                                                     |
| `wifiRssi`        | integer |          | -100–0 (dBm).                                                                                                                                      |

```bash
curl -X POST http://localhost:3000/api/v1/readings \
  -H 'Content-Type: application/json' \
  -H 'X-Device-Id: esp32-balcony-01' \
  -H 'X-Device-Key: 3f9a2b1c...' \
  -d '{
    "readingId": "7c3e1a2b-4f5d-4a6e-9b8c-1d2e3f4a5b6c",
    "deviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "recordedAt": "2026-01-01T12:00:00Z",
    "rawMoisture": 2048,
    "moisturePercent": 45.5,
    "firmwareVersion": "1.0.0",
    "wifiRssi": -60
  }'
```

#### Response

| Status | Meaning                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------- |
| `201`  | New reading stored. `status: "created"`.                                                                 |
| `200`  | Same `readingId` already stored for this device (idempotent retry, not an error). `status: "duplicate"`. |

Both share one body shape:

```json
{
  "readingId": "7c3e1a2b-4f5d-4a6e-9b8c-1d2e3f4a5b6c",
  "status": "created",
  "recordedAt": "2026-01-01T12:00:00.000Z",
  "receivedAt": "2026-01-01T12:00:01.482Z"
}
```

`receivedAt` is always server-generated at ingestion time — any
client-supplied `receivedAt` is silently ignored. The gap between the two
timestamps tells you whether a reading arrived in real time or was
buffered and submitted late (e.g. after a Wi-Fi outage).

#### Errors

| Status | Condition                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Payload failed validation, or `deviceId` doesn't match the authenticated device.                                                            |
| `401`  | Missing/invalid `X-Device-Id`/`X-Device-Key`.                                                                                               |
| `403`  | Device disabled.                                                                                                                            |
| `409`  | Device isn't assigned to a plant, **or** `readingId` already belongs to a **different** device (the original is left untouched either way). |

### Retries and duplicates

`readingId` is device-generated specifically so a device that times out
waiting for a response can safely **resend the exact same `readingId`**
rather than generating a new one — the server recognizes the retry
(`200`, `status: "duplicate"`, same `readingId` echoed back, no second row
written) rather than creating a duplicate. This also holds when two
identical retries race each other concurrently. See
`backend/README.md`'s "Retries and duplicates" for more detail, and
`backend/scripts/simulate-device.ts` for a runnable example (`npm run
simulate -- --replay`).

### `GET /api/v1/readings/recent`

The most recent readings across all of the **authenticated user's own**
plants/devices — a personal "all my sensors" activity view, not scoped to
one plant (contrast with `GET /api/v1/plants/:plantId/readings` below).

#### Query parameters

| Param   | Type    | Default | Notes  |
| ------- | ------- | :-----: | ------ |
| `limit` | integer |  `50`   | 1–500. |

```bash
curl "http://localhost:3000/api/v1/readings/recent?limit=10" \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

Ordered newest-first by `receivedAt` (when the reading reached the
server — this view is "what has the pipeline been doing lately," not the
true measurement history; use the per-plant history endpoint below for
that):

```json
{
  "readings": [
    {
      "id": "7c3e1a2b-4f5d-4a6e-9b8c-1d2e3f4a5b6c",
      "deviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "plantId": "9c858901-8a57-4791-81fe-4c455b099bc9",
      "recordedAt": "2026-01-01T12:00:00.000Z",
      "receivedAt": "2026-01-01T12:00:01.482Z",
      "rawMoisture": 2048,
      "moisturePercent": 45.5,
      "firmwareVersion": "1.0.0",
      "wifiRssi": -60,
      "device": { "identifier": "esp32-balcony-01" },
      "plant": { "name": "Balcony Fern" }
    }
  ]
}
```

#### Errors

| Status | Condition                                |
| ------ | ----------------------------------------- |
| `400`  | `limit` is not a positive integer ≤ 500. |
| `401`  | Missing/invalid `Authorization` header.  |

---

## Plants

Every endpoint in this section requires **user authentication** (see
"Authentication" above) and is scoped to the authenticated user's own
plants.

### `POST /api/v1/plants`

Creates a plant profile. `FR-PLANT-001`.

#### Request body

| Field            | Type   | Required | Notes                                          |
| ---------------- | ------ | :------: | ---------------------------------------------- |
| `name`           | string |    ✓     | 1–100 characters; whitespace-only is rejected. |
| `commonName`     | string |          | May be an empty string.                        |
| `scientificName` | string |          | May be an empty string.                        |
| `location`       | string |          | May be an empty string.                        |
| `notes`          | string |          | May be an empty string.                        |
| `potSize`        | string |          | May be an empty string.                        |
| `soilType`       | string |          | May be an empty string.                        |

```bash
curl -X POST http://localhost:3000/api/v1/plants \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Balcony Fern", "location": "Living room window"}'
```

#### `201` response

```json
{
  "plant": {
    "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "name": "Balcony Fern",
    "commonName": null,
    "scientificName": null,
    "location": "Living room window",
    "notes": null,
    "potSize": null,
    "soilType": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "userId": "0361ffa6-25ef-4285-bfa4-94724c32d1ce"
  }
}
```

`userId` is the authenticated caller's own `id`.

#### Errors

| Status | Condition                                   |
| ------ | ------------------------------------------- |
| `400`  | Missing/whitespace-only/over-length `name`. |
| `401`  | Missing/invalid `Authorization` header.     |

### `GET /api/v1/plants`

Lists the authenticated user's own plants.

```bash
curl http://localhost:3000/api/v1/plants \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

An array, `[]` if there are none. Each plant includes a `devices` array
of its currently **enabled** (actively reporting) devices only — a
disabled-but-still-assigned device is omitted here, though its `plantId`
foreign key is untouched (see `POST /api/v1/devices/:id/assign` above).
Device objects never include `credentialHash`.

```json
{
  "plants": [
    {
      "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
      "name": "Balcony Fern",
      "commonName": null,
      "scientificName": null,
      "location": "Living room window",
      "notes": null,
      "potSize": null,
      "soilType": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "userId": "0361ffa6-25ef-4285-bfa4-94724c32d1ce",
      "devices": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "Balcony ESP32",
          "identifier": "esp32-balcony-01",
          "enabled": true,
          "lastSeenAt": "2026-01-01T12:00:01.482Z",
          "reportingIntervalSeconds": 900,
          "firmwareVersion": "1.0.0"
        }
      ]
    }
  ]
}
```

#### Errors

| Status | Condition                                |
| ------ | ------------------------------------------ |
| `401`  | Missing/invalid `Authorization` header.  |

### `GET /api/v1/plants/:plantId`

A single plant, by `id`. Same shape as one entry of the
`GET /api/v1/plants` array above (including the enabled-only `devices`
array), wrapped as `{ "plant": { ... } }`.

```bash
curl http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9 \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### Errors

| Status | Condition                |
| ------ | ------------------------ |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |

### `POST /api/v1/plants/:plantId/device`

Plant-centric mirror of `POST /api/v1/devices/:id/assign` above —
identical behavior and error cases, reached via the plant's URL instead
of the device's. `FR-DEVICE-002`.

#### Request body

`deviceId` (string, required, the device's `id`), `reassign` (boolean,
optional, default `false`).

```bash
curl -X POST http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/device \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"deviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"}'
```

#### `200` response

`{ "device": { ...full updated device... } }`

#### Errors

Identical to `POST /api/v1/devices/:id/assign` above (`400`, `404` for
either ID, `409` for disabled or unauthorized-reassignment).

### `GET /api/v1/plants/:plantId/readings/latest`

The single newest reading for a plant, by `recordedAt` (true measurement
time — a late-arriving buffered reading never shadows a genuinely more
recent one just because it happened to reach the server first).

```bash
curl http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/readings/latest \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

`{ "reading": null }` if the plant has no readings yet (not a `404` — the
plant exists, it just has no data). Otherwise:

```json
{
  "reading": {
    "id": "7c3e1a2b-4f5d-4a6e-9b8c-1d2e3f4a5b6c",
    "deviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "plantId": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "recordedAt": "2026-01-01T12:00:00.000Z",
    "receivedAt": "2026-01-01T12:00:01.482Z",
    "rawMoisture": 2048,
    "moisturePercent": 45.5,
    "firmwareVersion": "1.0.0",
    "wifiRssi": -60
  }
}
```

#### Errors

| Status | Condition                |
| ------ | ------------------------ |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |

### `GET /api/v1/plants/:plantId/readings`

A plant's reading history, with optional time-range filtering. This is
the true measurement history (ordered/filterable by `recordedAt`) —
contrast with the global `GET /api/v1/readings/recent` above, which
orders by `receivedAt` instead.

#### Query parameters

| Param   | Type    | Default | Notes                                                                  |
| ------- | ------- | :-----: | ---------------------------------------------------------------------- |
| `start` | string  |    —    | ISO 8601 UTC — inclusive lower bound on `recordedAt`.                  |
| `end`   | string  |    —    | ISO 8601 UTC — inclusive upper bound. `start` must not be after `end`. |
| `sort`  | string  |  `asc`  | `asc` (oldest first — for plotting left-to-right) or `desc`.           |
| `limit` | integer |  `100`  | 1–1000.                                                                |

```bash
curl "http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/readings?start=2026-01-01T00:00:00Z&end=2026-01-02T00:00:00Z&sort=desc&limit=50" \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

`{ "readings": [ ...same reading shape as "latest" above..., ... ] }` —
`[]` if none match.

#### Errors

| Status | Condition                                                                |
| ------ | ------------------------------------------------------------------------ |
| `400`  | Malformed `start`/`end`, `start` after `end`, or invalid `limit`/`sort`. |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |

---

## Care events

Manually logged care actions (currently just watering) for a plant, kept
so they can be compared against its moisture reading history.
`FR-CARE-001`–`FR-CARE-004`. Every endpoint in this section requires
**user authentication** (see "Authentication" above) and is scoped to
plants owned by the authenticated user.

### `POST /api/v1/plants/:plantId/care-events`

#### Request body

| Field        | Type   | Required | Notes                                                                                                                             |
| ------------ | ------ | :------: | --------------------------------------------------------------------------------------------------------------------------------- |
| `type`       | string |    ✓     | Currently only `"WATERING"`.                                                                                                      |
| `occurredAt` | string |          | ISO 8601 UTC. Omit to mean "just now" — defaults to the current server time, so logging "I just watered this" needs no timestamp. |
| `amount`     | number |          | Must be ≥ 0 — a negative amount is rejected.                                                                                      |
| `unit`       | string |          | Free text, e.g. `"ml"`, `"oz"`, `"cups"`. Non-empty if provided.                                                                  |
| `notes`      | string |          | Free text.                                                                                                                        |

```bash
curl -X POST http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/care-events \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"type": "WATERING", "amount": 250, "unit": "ml", "notes": "morning watering"}'
```

#### `201` response

```json
{
  "careEvent": {
    "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
    "type": "WATERING",
    "plantId": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "occurredAt": "2026-01-01T12:00:00.000Z",
    "createdAt": "2026-01-01T12:00:00.000Z",
    "amount": 250,
    "unit": "ml",
    "notes": "morning watering",
    "deletedAt": null
  }
}
```

#### Errors

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Missing/invalid `type`, or a negative `amount`. |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |

### `GET /api/v1/plants/:plantId/care-events`

Lists a plant's care events, newest `occurredAt` first. Soft-deleted
events (see the `DELETE` endpoint below) are never included.

```bash
curl http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/care-events \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

`{ "careEvents": [ ...same shape as create's careEvent..., ... ] }` —
`[]` if none.

#### Errors

| Status | Condition                |
| ------ | ------------------------ |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |

### `PATCH /api/v1/plants/:plantId/care-events/:careEventId`

Updates a care event. All fields optional (same set as create above:
`type`, `occurredAt`, `amount`, `unit`, `notes`), but at least one is
required.

```bash
curl -X PATCH http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/care-events/b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"amount": 300, "notes": "topped up"}'
```

#### `200` response

`{ "careEvent": { ...full updated record... } }`

#### Errors

| Status | Condition                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | Validation failure, or an empty body.                                                                                                                                                                  |
| `401`  | Missing/invalid `Authorization` header.                                                                                                                                                                |
| `404`  | No care event with that ID **belonging to that plant, owned by the authenticated user** — a mismatched `plantId`/`careEventId` pair, or a plant belonging to a different user, 404s the same as either ID not existing at all. Also 404s for an event that's already soft-deleted. |

### `DELETE /api/v1/plants/:plantId/care-events/:careEventId`

**Soft** deletes a care event — the row is kept (with `deletedAt` set),
never actually removed, so a plant's true watering history can't be
silently rewritten by deleting the evidence a comparison-against-moisture
was ever based on. It simply stops appearing in the `GET` list above (and
becomes a `404` target for further `PATCH`/`DELETE` calls, same as if it
never existed).

No request body.

```bash
curl -X DELETE http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/care-events/b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `204` response

Empty body.

#### Errors

| Status | Condition                                                                                |
| ------ | ---------------------------------------------------------------------------------------- |
| `401`  | Missing/invalid `Authorization` header.                                                  |
| `404`  | No matching, not-already-deleted care event for that plant (same rule as `PATCH` above). |

---

## Analytics

Derived, computed views over a plant's readings and care events — never
raw data, and never fabricated where the underlying data doesn't support
a verdict. Both endpoints below explicitly report when there isn't
enough evidence rather than guessing. `FR-ANALYTICS-003`. Both require
**user authentication** (see "Authentication" above) and are scoped to
plants owned by the authenticated user.

### `GET /api/v1/plants/:plantId/moisture-trend`

Compares the plant's earliest and latest valid reading within a recent
window to say whether moisture is rising, falling, or holding steady —
"soil moisture went from 42% to 61% over the last day." Deliberately an
earliest-to-latest comparison, not a regression line or moving average:
simple and easy to explain plainly to a user.

#### Query parameters

| Param         | Type   | Default | Notes                              |
| ------------- | ------ | :-----: | ----------------------------------- |
| `windowHours` | number |  `24`   | How far back to look. Must be > 0. |

```bash
curl "http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/moisture-trend?windowHours=24" \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

`direction` is one of `INCREASING`, `DECREASING`, `STABLE`, or
`INSUFFICIENT_DATA` — a change within ±3 percentage points (not
configurable via this endpoint) counts as `STABLE`, since sensor noise
alone can produce a 1–2 point wobble between readings. Fewer than 3 valid
readings in the window is `INSUFFICIENT_DATA`; `earliest`/`latest`/
`changePercent` are omitted entirely in that case — there is deliberately
no fabricated change reported when there isn't enough evidence for one.

```json
{
  "trend": {
    "direction": "INCREASING",
    "readingCount": 3,
    "earliest": { "recordedAt": "2026-01-01T00:00:00.000Z", "moisturePercent": 30 },
    "latest": { "recordedAt": "2026-01-02T00:00:00.000Z", "moisturePercent": 60 },
    "changePercent": 30
  }
}
```

#### Errors

| Status | Condition                                   |
| ------ | -------------------------------------------- |
| `400`  | `windowHours` present but not a number > 0.   |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |

### `GET /api/v1/plants/:plantId/drying-rate`

Estimates how fast soil moisture is declining, in percent per hour, over
an analysis window split into watering-bounded periods — a watering
event always starts a new period (it physically resets the moisture
level, breaking the "continuous decline" assumption), regardless of how
large or small the time gap around it is. Zero watering events in the
window means exactly one period spanning the whole thing.

#### Query parameters

| Param        | Type   | Default | Notes                              |
| ------------ | ------ | :-----: | ----------------------------------- |
| `periodDays` | number |   `7`   | How far back to look. Must be > 0. |

```bash
curl "http://localhost:3000/api/v1/plants/9c858901-8a57-4791-81fe-4c455b099bc9/drying-rate?periodDays=7" \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

#### `200` response

`periods` is one entry per watering-bounded period, oldest first. Each
period's `state` is one of:

- `VALID` — a usable rate, no unusually large gap between readings.
- `LOW_CONFIDENCE` — a usable rate, but a gap larger than 6 hours between
  two consecutive readings means the true moisture path between them is
  unknown, not a straight line.
- `NOT_DRYING` — moisture rose or held steady in this period; there is no
  meaningful "drying rate" to report, so `ratePercentPerHour` is omitted.
- `INSUFFICIENT_DATA` — fewer than 3 readings fell in this period;
  `ratePercentPerHour` is omitted.

`ratePercentPerHour` (present only for `VALID`/`LOW_CONFIDENCE`) is
always a non-negative magnitude ("declining at 2.3%/hour"), never a
signed delta.

```json
{
  "dryingRate": {
    "analysisPeriodStart": "2026-01-01T00:00:00.000Z",
    "analysisPeriodEnd": "2026-01-08T00:00:00.000Z",
    "unit": "percent_per_hour",
    "periods": [
      {
        "state": "VALID",
        "periodStart": "2026-01-01T00:00:00.000Z",
        "periodEnd": "2026-01-08T00:00:00.000Z",
        "readingCount": 3,
        "ratePercentPerHour": 5,
        "hasGap": false
      }
    ]
  }
}
```

#### Errors

| Status | Condition                                    |
| ------ | --------------------------------------------- |
| `400`  | `periodDays` present but not a number > 0.     |
| `401`  | Missing/invalid `Authorization` header.                          |
| `404`  | No plant with that `id` belonging to the authenticated user.     |
