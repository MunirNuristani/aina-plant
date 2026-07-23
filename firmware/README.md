# Firmware

ESP32 firmware for the aina-plant soil-moisture monitor. Built with
[PlatformIO](https://platformio.org/) targeting the Arduino framework.

## Setup

PlatformIO (the `pio` CLI) lives in a project-local virtualenv,
`firmware/.venv` (gitignored) — it doesn't touch your global Python or any
system-wide tool.

```bash
cd firmware
python3 -m venv .venv && source .venv/bin/activate  # first time only
pip install platformio                              # first time only

pio run                  # compile (esp32dev target)
pio run --target upload  # flash to a connected ESP32
pio device monitor       # view Serial output (115200 baud)
pio test -e native        # run the unit tests (on your machine, no hardware needed)
```

Once created, just `source .venv/bin/activate` in future sessions before
running `pio` commands.

## Soil moisture sensor module

`lib/SoilMoistureSensor/` reads a capacitive soil moisture sensor on a
single analog pin and produces one filtered raw ADC value (0-4095 — the
ESP32's native 12-bit ADC range, the same domain the backend's
`rawMoisture` and calibration values use). It has no knowledge of
calibration, percentages, Wi-Fi, or the backend API — those are separate
concerns that will be layered on top of this module.

### Why median filtering, and why these defaults

Each call to `read()` takes several raw ADC samples, spaced apart in time,
and returns their **median** (not a plain average) as the filtered value.
Median filtering was chosen over averaging because it's much more
resistant to a single noisy or spurious sample — one outlier can pull an
average significantly, but has no effect on the median at all as long as
it's still just one sample among several.

The constructor's defaults (see `SoilMoistureSensor.h`):

| Parameter         | Default | Why                                                                                                                      |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `sampleCount`      | `10`    | Enough samples for the median to meaningfully reject a single bad reading, without a reading cycle taking noticeably long. |
| `sampleDelayMs`    | `15`    | Lets the ADC and the sensor's own analog output settle between samples, rather than sampling faster than the signal changes. |
| `maxSampleSpread`  | `500`   | If the samples disagree by more than this (out of the 4095 full range), the reading is treated as unstable rather than being blended into a misleading number. |

These are starting points, not measured values — there's no physical
sensor available to tune them against yet. All three are constructor
parameters, easy to adjust once real hardware is on hand.

### Configuring the pin(s)

The sensor's pin is **not** hardcoded inside the module — it's passed in
by whatever code constructs a `SoilMoistureSensor`. This board wires up
4 of them (one per plant, see "Device provisioning" below for the
4-channel architecture), each on its own pin, listed in one place in
`src/main.cpp`:

```cpp
constexpr uint8_t SOIL_SENSOR_PINS[DeviceConfigStore::CHANNEL_COUNT] = {34, 32, 33, 35};
```

Change these to rewire a sensor to a different pin — nothing inside
`SoilMoistureSensor` itself needs to change; it's already designed to be
instantiated once per pin (see `Channel`'s constructor in `main.cpp`).
GPIO32/33/34/35 were chosen because they're all ADC1 pins, which (unlike
ADC2) stay usable once Wi-Fi is active. Channel 1 keeps GPIO34, the pin
the original single-sensor build already used.

### Failure detection — never invented data

`analogRead()` has no error return on ESP32: a disconnected, shorted, or
otherwise faulty sensor still returns a plausible-looking integer. There's
no hardware fault code to check. Instead, `read()` sanity-checks the
collected samples themselves and reports a failure — never a fabricated
number — when:

- **All samples read exactly 0** — the pin is likely grounded or the
  sensor is disconnected.
- **All samples read exactly the ADC max (4095)** — the pin is likely
  floating or shorted to VCC.
- **The spread between the highest and lowest sample exceeds
  `maxSampleSpread`** — the reading is unstable (loose wire, interference),
  not a real, coherent measurement.

`read()` returns a `SoilMoistureSample` struct with a `success` flag.
Callers must check it before using `rawValue` — on failure, `rawValue` is
set to `-1` purely as a sentinel and must never be treated as real data
(see the usage pattern in `src/main.cpp`, which always checks `success`
first).

### Serial logging

Every sample, the final filtered value (or the specific failure reason),
and the sensor's configuration at startup are all logged to `Serial` (see
`SoilMoistureSensor::begin()` and `::read()`). Connect with
`pio device monitor` at 115200 baud to see them.

## Moisture calibration module

`lib/MoistureCalibration/` converts a raw ADC reading (from
`SoilMoistureSensor`) into a 0-100 moisture percentage, using a device's
dry/wet calibration reference points. Unlike `SoilMoistureSensor`, it has
**no Arduino dependency at all** — it's pure calculation logic, which is
what makes it possible to unit-test on the host machine (`pio test -e
native`) instead of only ever finding out it's correct once flashed to
real hardware.

**Calibration values are centralized** as one `MoistureCalibration{dryValue,
wetValue}` struct, constructed once in `src/main.cpp`
(`soilCalibration`) — the single place to change if the device is
recalibrated. (A future ticket will sync these from the backend's
`Calibration` API instead of a compile-time constant.)

**Validation**: `MoistureCalibration::isValid()` requires both values to be
within the ADC's real range (`0-4095`) and distinct from each other (equal
values would divide by zero) — mirrors the backend's own calibration
validation (`backend/src/validation/calibration.ts`). `main.cpp` checks
this once at startup and logs a loud, hard-to-miss warning if it's
invalid — but `convertToMoisturePercent()` also re-checks it on **every**
call, so a bad calibration can never silently produce a meaningless
percentage even if that startup warning goes unnoticed.

**Conversion and clamping**: linear interpolation between the two
calibration points, works whether `dryValue > wetValue` (the common case)
or the reverse (some sensors/wirings read the other way). The result is
always clamped to `[0, 100]`, since a raw reading can drift past its
calibrated bounds (sensor aging, needs recalibrating) without that being
allowed to produce a nonsensical percentage.

**The raw value is always preserved** in the returned `MoistureReading`,
even when conversion fails due to invalid calibration — `rawValue` is set
regardless of `success`.

Run the tests:

```bash
pio test -e native
```

`test/test_moisture_calibration/test_main.cpp` covers: valid/invalid
calibration (equal values, out-of-range values), conversion at both
calibration endpoints and the midpoint, clamping beyond both ends, the
inverted-calibration case, and that the raw value survives a failed
conversion.

## Wi-Fi service module

`lib/WifiService/` connects the ESP32 to a Wi-Fi network using configured
credentials, logs connection state, detects disconnection, and retries with
a controlled delay — all **without ever blocking the main loop**. The old
`aina_core.ino` sketch's `connectWifi()` blocked in a
`while (WiFi.status() != WL_CONNECTED) { delay(500); ... }` loop; nothing in
this module ever spins or `delay()`s waiting on the network.

### Non-blocking design

`WifiService::update()` must be called on every `loop()` iteration. It only
ever reads `WiFi.status()` and `millis()` and returns immediately — it never
blocks. It:

- Logs once when the connection transitions to connected (with the IP), and
  once when it transitions to disconnected.
- While not connected (whether that's the first attempt still in progress,
  or a reconnect after a drop), retries no more often than `retryDelayMs`
  (default 5000ms, configurable via the constructor) — reusing
  `lib/RetryTimer/`'s `shouldRetryNow()` for the same overflow-safe timing
  logic already unit-tested in `test/test_retry_timer/`, rather than
  reimplementing it here.

### Credential redaction

Credentials are passed into the constructor by the caller (`main.cpp`), not
hardcoded in this module — mirrors `SoilMoistureSensor`'s pin-injection
pattern. The password is never logged anywhere in this module. The SSID is
masked before logging (`maskSsid()` in `WifiService.cpp`, keeps only the
first/last character, e.g. `A********7`) so Serial output never reveals the
full configured credentials.

`main.cpp` no longer holds Wi-Fi credentials as compile-time constants at
all — see "Device provisioning" below for where they actually come from.

### Why no native tests

`WifiService` depends on `WiFi.h`/`Arduino.h` (like `SoilMoistureSensor`),
so it's excluded from the `native` PlatformIO environment (see
`platformio.ini`'s `lib_ignore`) and can only be verified on real hardware.
The one piece of non-trivial logic it relies on — the retry-delay timing —
is factored into `RetryTimer`, which *is* natively unit-tested.

### `consecutiveFailedAttempts()`

Every time `update()`'s retry branch calls `attemptConnect()` while not
connected, a counter increments; it resets to 0 on the connected
transition. This is the signal an already-provisioned device uses to
decide it should give up on its configured network and fall back into
setup mode — see "Device provisioning" below.

## Device provisioning

This board is exactly 4 soil-moisture channels (see `Channel`/`channels`
in `main.cpp`) sharing one Wi-Fi radio and one LCD — never a generic
N-sensor abstraction, and no other sensor types are planned. Wi-Fi
credentials (shared by all 4 channels) and each channel's server-assigned
`deviceId`/`deviceKey` are never compile-time constants and never require
a reflash to change. All of it is loaded at boot from `DeviceConfigStore`
(flash/NVS-backed) and, whenever it's missing or no longer works,
(re)provisioned over `ProvisioningPortal`'s SoftAP setup mode instead.

### Why SoftAP instead of Bluetooth

The obvious alternative — configuring Wi-Fi over BLE from the phone's
browser (Web Bluetooth) — doesn't exist on iOS at all (every browser
there, including Chrome, is built on WebKit, which doesn't implement
`navigator.bluetooth`). Since the frontend is a mobile-first PWA, that
would leave iPhone users with no path. SoftAP works identically on every
phone/OS/browser: the device briefly hosts its own open Wi-Fi network,
the phone joins it like any other network, and a plain web form does the
rest — the same pattern smart plugs and similar hardware use.

### Why the setup link is a real link/QR, not a fetch() call

The frontend is served over HTTPS. A page served over HTTPS cannot
`fetch()`/XHR a plain-`http://` URL — browsers block that as mixed
content. A genuine **top-level navigation** to a plain-`http://` URL
(clicking a real `<a href="http://...">`, or scanning a QR code encoding
one) is *not* blocked, since it isn't a subresource load. So after
registering a board's 4 channels (or rotating one channel's credential),
the frontend hands the user a tappable link/QR of the form
`http://192.168.4.1/setup?boardIdentifier=...&deviceId1=...&deviceKey1=...&deviceId2=...&deviceKey2=...&deviceId3=...&deviceKey3=...&deviceId4=...&deviceKey4=...`
(built by `frontend/src/lib/device-setup-url.ts`, with 1 to 4 channel
slots depending on whether it's initial registration or a single
channel's rotation) to open *after* joining the device's temporary AP,
rather than trying to call that URL from within the page itself.

### Why one `BOARD_IDENTIFIER` with derived `-chN` suffixes, not 4 independent constants

`main.cpp`'s `BOARD_IDENTIFIER` (e.g. `"esp32-quad-01"`) is fixed per
physical unit at flash time, printed as that unit's QR label, and is what
the frontend derives all 4 channels' identifiers from
(`"esp32-quad-01-ch1"` .. `"-ch4"`), matching what the frontend's
`board-pairing-flow.tsx` registers each channel's `Device.identifier` as
in the backend (`@unique`). One base identifier with derived suffixes,
computed once in `setup()` via `snprintf`, is the single source of truth
— 4 hand-written compile-time constants could drift apart (a typo in one
channel's constant silently mismatches the backend). This convention is a
cross-repo contract with no shared constant enforcing it: keep
`main.cpp`'s `"%s-ch%u"` format and `board-pairing-flow.tsx`'s
`` `${boardIdentifier}-ch${n}` `` in lockstep if either ever changes.

### What's in NVS vs. what stays a flash-time constant

`DeviceConfigStore` persists `wifiSsid`/`wifiPassword` (shared by all 4
channels — one radio) and each channel's `deviceId`/`deviceKey` (4
independent pairs) — the things that can legitimately change after a
unit ships. `BOARD_IDENTIFIER` deliberately stays a compile-time constant
(see above) — there's no scenario where it needs to change at runtime.

### Merge, not overwrite: single-channel credential rotation

`DeviceConfigStore::save()` merges into whatever's already stored —
writing only the fields actually supplied (non-empty), leaving everything
else in flash untouched. This is what makes single-channel credential
rotation possible: `device-detail-controls.tsx`'s "Reconfigure Wi-Fi"
submits just one channel's `deviceId`/`deviceKey` (via
`ProvisioningPortal`'s form, ssid/password and the other 3 channels
omitted), and the merge preserves the Wi-Fi credentials and the other 3
channels' identities rather than forcing the user to re-enter their home
Wi-Fi password or re-touch 3 unrelated sensors just to rotate one
channel. A true first-time board registration simply supplies all 10
fields, which has the same net effect a full overwrite would.
`ProvisioningPortal::handleSetup()` only requires `ssid` non-empty when
`DeviceConfigStore::load()` finds no prior config to fall back on — a
single-channel rotation submission is expected to omit it.

### `ProvisioningPortal`'s `/setup` form

`GET /` and `GET /setup` serve a single self-contained HTML form (a
`PROGMEM` string literal — no build step, no SPIFFS). Query args from the
incoming request (`boardIdentifier` plus whichever of `deviceId1..4`/
`deviceKey1..4` are present, carried over from the frontend's link/QR)
are read server-side and echoed straight into the form's hidden fields,
so the user only has to fill in their Wi-Fi network's name and password
— no client-side JavaScript parses the URL. `POST /setup` validates the
submitted `boardIdentifier` against the compiled-in `BOARD_IDENTIFIER`
**before writing anything to `Preferences`** — this is a board-level
check (all 4 channels on one physical unit share it), and catches being
on the wrong physical board's AP mid-setup (e.g. a second board's link
tapped while still joined to the first one's network): on mismatch, it
responds with an error and does not save or reboot. On a match, it
builds the merged `Config` (see above) and calls `DeviceConfigStore::save()`
then `ESP.restart()`.

### Brand-new unit vs. an already-provisioned board losing connectivity — the same code path

Both converge on the identical `main.cpp::enterProvisioningMode()`, just
triggered from different call sites:

- **Brand-new unit** (or one explicitly cleared): `setup()` calls
  `DeviceConfigStore::load()`, which returns false when any of the 10
  stored fields (`wifiSsid`, `wifiPassword`, 4×`deviceId`, 4×`deviceKey`)
  is missing, and enters provisioning mode immediately — skipping
  `wifiService.begin()` entirely, since there's nothing to connect with
  yet.
- **Already-provisioned board that can no longer reach its network**
  (moved, router changed, password rotated): `loop()` checks
  `shouldEnterProvisioningMode(wifiService.consecutiveFailedAttempts(),
  WIFI_FAILURE_THRESHOLD_FOR_PROVISIONING)` (`lib/ProvisioningTrigger/`)
  every iteration, and enters the same mode once that threshold trips —
  board-level (one shared Wi-Fi connection for all 4 channels), no
  button, no manual reset required. All 4 channels stop reporting
  simultaneously when this trips, and resume together once reconnected.

Going the other direction — provisioning back to normal operation —
always goes through `ESP.restart()` after a successful `/setup`
submission, so `setup()` re-runs from a clean boot with `load()` now
succeeding, rather than trying to reconstruct `WifiService`/each
channel's `ReadingSubmitter` live with new credentials.

### The AP is open, by design

`ProvisioningPortal`'s SoftAP has no password and stays up until a
successful submission or a manual power cycle. This is an accepted
trade-off for a personal plant-monitoring device with nothing sensitive
beyond revocable device credentials (rotatable via
`POST /devices/:id/rotate-credential` per channel if ever suspected
exposed) — the same spirit as `ReadingSubmitter`'s `setInsecure()`
trade-off above. A future iteration could add a fixed or QR-printed AP
passphrase if that stops being acceptable.

### Sequential channel processing, not concurrent

`main.cpp`'s `loop()` runs `runChannelCycle()` for all 4 channels, one
after another, within a single pass — not truly concurrently. Since each
channel's cycle can make one blocking, bounded HTTP submission (see
`ReadingSubmitter`'s 15-second internal timeout), a worst-case pass (all
4 channels blocking at once) takes meaningfully longer than the original
single-sensor build's cycle did. Accepted trade-off at this board's scale
(4 channels, not dozens) — each channel's `ReadingRetrier` still tracks
its own in-flight retry independently (see `Channel`'s per-channel
`submitter`/`retrier` in `main.cpp`), so one channel's pending retry
never blocks the other three's fresh reads; it's only the sequential
ordering within one pass that's shared.

### Why no native tests (`DeviceConfigStore`, `ProvisioningPortal`)

Both depend on `Preferences.h`/`WiFi.h`/`WebServer.h`/`DNSServer.h`, so
they're excluded from the `native` PlatformIO environment (see
`platformio.ini`'s `lib_ignore`) and can only be verified on real
hardware — same reasoning as `WifiService`/`ReadingSubmitter`. The one
piece of non-trivial decision logic either of them depends on — the
failure-threshold check — is factored into `lib/ProvisioningTrigger/`,
which *is* natively unit-tested (`test/test_provisioning_trigger/`),
mirroring `RetryTimer`'s split.

## Firmware reading payload

`lib/FirmwareReading/` builds and serializes the JSON payload the backend's
`POST /api/v1/readings` expects, matching
`backend/src/validation/reading.ts`'s `sensorReadingSchema` field-for-field:
`readingId`, `deviceId`, `recordedAt`, `rawMoisture`, `moisturePercent`, and
— only when present — `firmwareVersion` and `wifiRssi`.

This module (and the two it's built on, `lib/UuidV4/` and `lib/Iso8601/`)
holds fixed-size buffers only — no Arduino `String`, no dynamic allocation
— and has **no Arduino dependency at all**, unlike `SoilMoistureSensor` and
`WifiService`. ArduinoJson itself is explicitly designed to build on plain
C++ as well as Arduino, so the whole reading-assembly-and-serialization
path is unit-tested on the host machine (`test/test_firmware_reading/`,
`test/test_uuid_v4/`, `test/test_iso8601/`) rather than only ever trusted
because it "looks right" once flashed.

Generating the *inputs* to a `FirmwareReading` — a random reading ID, the
current wall-clock time, a live RSSI reading — is hardware-dependent and
deliberately kept out of this module; `main.cpp` is where those get
gathered (see below) and handed in as plain values.

### Stable reading IDs

`readingId` is a UUID v4, generated once when a reading is captured (see
`generateReadingId()` in `main.cpp`, which gathers 16 bytes from the
ESP32's hardware RNG (`esp_random()`) and hands them to `UuidV4`'s pure
formatter). "Stable" means this ID is generated **once** per physical
reading and reused for that reading's entire lifetime — including any
future retry of submitting it — never regenerated per submission attempt.
That's what lets the backend's idempotent-retry handling
(`reading-service.ts`'s duplicate-`readingId` path) recognize a retried
submission as the same reading rather than creating a duplicate row.

`lib/UuidV4/` only *formats* 16 given bytes into a UUID v4 string (forcing
the RFC 4122 version/variant bits); it doesn't generate randomness itself,
which is what keeps it Arduino-free and natively testable with
deterministic byte arrays.

### ISO 8601 timestamps and NTP

`lib/Iso8601/` formats a UTC epoch time into `"YYYY-MM-DDTHH:MM:SSZ"`,
matching the backend's `z.iso.datetime()` check. It takes `uint32_t`
epoch seconds rather than `time_t` on purpose — `time_t` is commonly a
signed 32-bit type that overflows at 2038-01-19T03:14:07Z (the "Y2038
problem"); `uint32_t` covers every date up to 2106-02-07T06:28:15Z, both
verified in `test/test_iso8601/`.

The ESP32 has no wall-clock time until it's told one: `main.cpp` kicks off
an NTP sync (`configTime()`) once `WifiService` first reports connected,
and `time(nullptr)` starts returning real UTC time asynchronously once
that finishes (typically a few seconds). Until then, `main.cpp` skips
building a reading payload entirely rather than reporting a meaningless
1970 timestamp — the same "never fabricate data" principle
`SoilMoistureSensor` and `MoistureCalibration` apply to their own failure
cases.

### deviceId vs. the X-Device-Id header — these are not the same value

The backend's `Device` model has two separate identifying fields (see
`backend/prisma/schema.prisma`): `identifier` (a human-chosen string, used
for the `X-Device-Id` auth header) and `id` (a server-generated UUID). The
reading payload's `deviceId` field must be the device's `id`, **not** its
`identifier` — `ingestReading()` checks it against the *authenticated*
device's `id`. `main.cpp` holds this as a separate `DEVICE_ID` placeholder
constant — fill it in with the real UUID returned by the backend's device
registration endpoint (`POST /api/v1/devices`) once a device is
registered.

## Submitting readings to the backend

`lib/ReadingSubmitter/` sends an already-serialized reading (from
`serializeFirmwareReading()`) to the backend's `POST /api/v1/readings` over
HTTP, with the `X-Device-Id` / `X-Device-Key` headers
`backend/src/middleware/device-auth.ts` requires. `main.cpp` calls
`readingSubmitter.submit(json)` once per reading, right after building and
logging its JSON.

Response interpretation is split out into `lib/ReadingSubmitOutcome/` — a
pure function, `classifySubmitResponse(httpStatusCode, responseBody)`, with
no Arduino dependency, unit-tested on the host machine
(`test/test_reading_submit_outcome/`) against every response shape the
backend can actually return (201 created, 200 duplicate,
400/401/403/404/409/429/500-504 errors, a network-level failure with no
real response). `ReadingSubmitter` itself — the part that actually calls
`HTTPClient` — is Arduino-dependent and can only be verified on real
hardware, same reasoning as `WifiService`.

**Blocking, but bounded**: `HTTPClient::POST()` has no async variant on
this platform, so `submit()` blocks for the duration of one HTTP request —
bounded by a 15-second internal timeout, not indefinite. `submit()` also
skips the request entirely (no attempt, no timeout wait) if Wi-Fi isn't
currently connected.

**Logging**: the HTTP status code and response body are logged — both are
the backend's own response and contain nothing credential-bearing (see
`backend/src/routes/readings.ts`'s response shapes). `deviceKey_` is never
logged, mirroring `WifiService`'s "never log credentials" principle for
the Wi-Fi password.

**Plain HTTP, not HTTPS**: this targets the backend running on your local
network during development, not a deployed production API. A production
deployment would need an `https://` `API_URL` plus a
`WiFiClientSecure`/certificate setup, which is out of scope here.

### Local network address setup

`main.cpp`'s `API_URL` currently points at this project's deployed backend
(`https://aina-plant.onrender.com/api/v1/readings` — see
`docs/DEPLOYMENT.md`), which works from anywhere with Wi-Fi, not just your
dev LAN. `ReadingSubmitter` picks plain HTTP or HTTPS automatically based
on `API_URL`'s scheme (see `ReadingSubmitter.h`), so pointing it at a local
backend instead — e.g. while iterating on backend code and wanting faster
feedback than a redeploy — still works. To do that:

The ESP32 can't reach the backend at `localhost` — from the ESP32's point
of view, `localhost` means the ESP32 itself. `API_URL` must instead point
at your development machine's **LAN IP address**, and both devices must be
on the same network (e.g. the ESP32 joined to the same Wi-Fi network your
machine is on/near).

1. Start the backend locally (see `backend/README.md`): `npm run db:up`,
   then `npm run dev`. Note the port it logs (`backend/.env`'s `PORT`,
   default `3000` — but see the note below if that port is already in use
   by something else on your machine).
2. Find your machine's LAN IP:
   - macOS: `ipconfig getifaddr en0` (or `en1` if you're on Wi-Fi via a
     different interface)
   - Linux: `hostname -I | awk '{print $1}'`
   - Windows: `ipconfig` and look for the Wi-Fi adapter's IPv4 address
3. Set `main.cpp`'s `API_URL` to
   `"http://<that IP>:<that port>/api/v1/readings"`, e.g.
   `"http://192.168.1.93:3000/api/v1/readings"`.
4. Make sure your machine's firewall allows inbound connections to that
   port from your local network (macOS may prompt the first time; allow
   it).

If port 3000 is already in use by something else, run the backend on a
different port instead of fighting the conflict: `PORT=3001 npm run dev`,
and use that port in `API_URL` instead.

### Testing against the seeded dev device

`main.cpp`'s compiled-in `API_URL` points at the deployed backend, not the
local seed fixture. To test against a freshly seeded *local* backend
instead: temporarily set `API_URL` to your machine's LAN address (see
above), reflash, then provision the device over its setup AP — no other
source edits needed, since Wi-Fi/device credentials aren't compiled in
anymore (see "Device provisioning" above):

1. Join the board's `AINA-Setup-esp32-quad-01` network (or whatever
   `BOARD_IDENTIFIER` you flashed).
2. Open (or `curl -X POST`) this URL, using `backend/prisma/seed.ts`'s
   fixture device — `dev-seed-device-001` /
   `dev-only-seed-credential-do-not-use-in-production`, a committed,
   intentionally-public dev-only credential already assigned to a seed
   plant — plus its real `Device.id` (a UUID, looked up via the command
   below, **not** the identifier string — see "deviceId vs. the
   X-Device-Id header" above for why they differ). The seed fixture is a
   single device, so this only fills channel 1's slot (`deviceId1`/
   `deviceKey1`) — the other 3 channels stay unprovisioned, which is fine
   for testing the readings pipeline against one seeded plant:

   ```bash
   # Look up the seed device's real Device.id:
   curl -X POST http://localhost:3000/api/v1/devices/auth \
     -H 'Content-Type: application/json' \
     -d '{"identifier":"dev-seed-device-001","credential":"dev-only-seed-credential-do-not-use-in-production"}'
   ```

   ```bash
   curl -X POST http://192.168.4.1/setup \
     --data-urlencode "ssid=<your network>" \
     --data-urlencode "password=<your password>" \
     --data-urlencode "boardIdentifier=esp32-quad-01" \
     --data-urlencode "deviceId1=<the UUID from above>" \
     --data-urlencode "deviceKey1=dev-only-seed-credential-do-not-use-in-production"
   ```

Revert `API_URL` back to the deployed URL afterward, same as you would for
a temporary local-backend edit.

### Verifying storage in PostgreSQL

Once a reading submission logs `HTTP 201` or `HTTP 200`, confirm it's
actually in the database:

```bash
docker exec aina-plant-postgres psql -U user -d aina_plant \
  -c 'SELECT id, "deviceId", "rawMoisture", "moisturePercent", "recordedAt" FROM "SensorReading" ORDER BY "receivedAt" DESC LIMIT 5;'
```

or via `npm run prisma:studio` for a browser UI.

## Retry behavior

`lib/ReadingRetrier/` sits on top of `ReadingSubmitter`, adding retry
policy — mirroring how `WifiService` layers retry policy on top of raw
`WiFi.begin()`/`status()` calls, reusing the same `lib/RetryTimer/` timing
logic for the controlled delay between attempts. `main.cpp` calls
`readingRetrier.beginSubmission(json)` once a reading's JSON is built
(instead of calling `readingSubmitter.submit()` directly), and
`readingRetrier.update()` every `loop()` iteration to drive any pending
retry.

### Classification: what gets retried

Retryability is decided by `ReadingSubmitOutcome`'s `isRetryable` field
(see `lib/ReadingSubmitOutcome/ReadingSubmitOutcome.h` for the exact
rule):

| Response                                          | Retryable? | Why                                                            |
| -------------------------------------------------- | :--------: | ---------------------------------------------------------------- |
| Network-level failure (`httpStatusCode <= 0`)       | ✅         | DNS/connection/timeout/no-Wi-Fi — nothing about the request itself was rejected |
| `5xx` (server error)                                | ✅         | Backend/database trouble, presumed transient                    |
| `429` (too many requests)                           | ✅         | Standard "retry later" code, even though this backend doesn't currently emit it |
| `4xx` other than `429` (400/401/403/404/409)        | ❌         | The backend rejected this specific request — an identical retry fails identically every time |

### Reusing the same reading ID

`ReadingRetrier::beginSubmission()` copies the caller's JSON — including
its `readingId` — into its own internal buffer, and every retry resends
that exact same buffer, byte for byte. No new reading is ever captured, and
no new `readingId` is ever generated, until the pending one resolves (see
below). This is what lets the backend's idempotent-retry handling
(`reading-service.ts`'s duplicate-`readingId` path) recognize a retry as
the same reading, and it's what keeps a reading's `recordedAt` accurate to
when it was actually measured even if it takes several attempts (and
several seconds or more) to actually get stored — verified on real
hardware: a reading that failed twice (connection refused) before
succeeding on its third attempt, ~20 seconds later, landed in Postgres with
its original `recordedAt` intact and a `receivedAt` ~20 seconds later,
under the same `readingId` throughout.

### Controlled delay, and giving up

`ReadingRetrier`'s constructor takes `retryDelayMs` (default 10000) and
`maxAttempts` (default 5, counting the first attempt). Between attempts,
`update()` only acts once `RetryTimer::shouldRetryNow()` says the delay has
elapsed — never a blocking wait. This is a **fixed controlled delay, not
exponential backoff** — the same choice `WifiService` already makes for
its own reconnect delay, for the same reason: simplicity, and readings
happen on a slow (multi-second) cadence anyway, so aggressive backoff
tuning isn't worth the added complexity here.

A non-retryable failure gives up **immediately** (zero retries — verified
on real hardware: a `deviceId` mismatch produced a `400`, logged
"giving up immediately (no retry)," and a **fresh** reading was captured
on the very next cycle rather than waiting out the retry delay). A
retryable failure keeps retrying until it succeeds or `maxAttempts` is
exhausted, whichever comes first — once exhausted, the reading is dropped
and normal capture resumes on the next cycle.

### Staying responsive

`WifiService::update()` and the NTP-sync check both run every `loop()`
iteration *before* `ReadingRetrier` is even consulted, so a pending retry
never delays Wi-Fi reconnect logic. `ReadingRetrier::update()` itself is a
cheap no-op unless a retry is both pending and due. The one thing that
still blocks is an individual HTTP attempt itself (via `HTTPClient`,
bounded by its 15-second timeout — see "Submitting readings to the
backend" above) — retrying avoids blocking *between* attempts, not
blocking *during* one.

### Retry limitations

- **One in-flight reading at a time, not a queue.** While a reading is
  retrying, `main.cpp` skips capturing a new sensor reading entirely
  (`readingRetrier.isPending()` gates it) rather than buffering multiple
  pending readings. This keeps the implementation simple, at the cost of:
  pausing fresh measurements for the duration of a retry sequence (up to
  `maxAttempts × retryDelayMs`, ~50 seconds with the defaults).
- **Bounded retries mean bounded data loss.** After `maxAttempts` total
  attempts, a reading is dropped for good — there's no persistent buffer
  or disk-backed queue that would let it survive a longer outage. This
  firmware reduces data loss from *brief* network/server blips, not
  arbitrarily long outages.
- **No persistence across reboots.** Retry state (the pending JSON,
  attempt count, timer) lives only in RAM. A reboot mid-retry loses that
  one in-flight reading.
- **Fixed delay, not backoff.** See above — a deliberate simplicity
  tradeoff, not an oversight.

## Project layout

```
firmware/
  platformio.ini                    PlatformIO project + board/test environments
  src/main.cpp                      Entry point (setup/loop) — Channel struct + runChannelCycle() drive the 4 sensor channels
  lib/SoilMoistureSensor/            Reads + filters the raw sensor value (needs Arduino/hardware)
  lib/MoistureCalibration/           Converts raw → percent (pure logic, natively testable)
  lib/RetryTimer/                    Overflow-safe "should retry now" timing (pure logic, natively testable)
  lib/WifiService/                   Non-blocking Wi-Fi connect/reconnect + redacted logging (needs Arduino/hardware)
  lib/UuidV4/                        UUID v4 formatting from given random bytes (pure logic, natively testable)
  lib/Iso8601/                       Epoch seconds → ISO 8601 UTC string (pure logic, natively testable)
  lib/FirmwareReading/               API-compatible reading struct + ArduinoJson serializer (pure logic, natively testable)
  lib/ReadingSubmitOutcome/          Classifies an HTTP response into success/duplicate/retryable (pure logic, natively testable)
  lib/ReadingSubmitter/              POSTs a reading to the backend with device auth headers (needs Arduino/hardware)
  lib/ReadingRetrier/                Retry policy (classify, controlled delay, same reading ID, bounded attempts) on top of ReadingSubmitter (needs Arduino/hardware)
  lib/DeviceConfigStore/             Persists Wi-Fi/device credentials to flash (NVS via Preferences) (needs Arduino/hardware)
  lib/ProvisioningTrigger/           "Give up and re-provision?" threshold check (pure logic, natively testable)
  lib/ProvisioningPortal/            SoftAP + self-served /setup form for (re)provisioning (needs Arduino/hardware)
  test/test_moisture_calibration/    Unit tests for MoistureCalibration (`pio test -e native`)
  test/test_retry_timer/             Unit tests for RetryTimer (`pio test -e native`)
  test/test_uuid_v4/                 Unit tests for UuidV4 (`pio test -e native`)
  test/test_iso8601/                 Unit tests for Iso8601 (`pio test -e native`)
  test/test_firmware_reading/        Unit tests for FirmwareReading (`pio test -e native`)
  test/test_reading_submit_outcome/  Unit tests for ReadingSubmitOutcome, including retryability (`pio test -e native`)
  test/test_provisioning_trigger/    Unit tests for ProvisioningTrigger (`pio test -e native`)
```
