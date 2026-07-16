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

### Configuring the pin

The sensor's pin is **not** hardcoded inside the module — it's passed in
by whatever code constructs a `SoilMoistureSensor`. In `src/main.cpp`,
that's the single `SOIL_SENSOR_PIN` constant at the top of the file:

```cpp
constexpr uint8_t SOIL_SENSOR_PIN = 34;
SoilMoistureSensor soilSensor(SOIL_SENSOR_PIN, /* sampleCount= */ 10, /* sampleDelayMs= */ 15);
```

Change that one constant to rewire the sensor to a different pin —
nothing inside `SoilMoistureSensor` itself needs to change. GPIO34 was
chosen because it's one of the ESP32's ADC1 pins, which (unlike ADC2)
stay usable once Wi-Fi is active.

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

`main.cpp` holds `WIFI_SSID`/`WIFI_PASSWORD` as placeholder constants —
replace them with real values before flashing, but never commit real
credentials to this file (it's tracked in git).

### Why no native tests

`WifiService` depends on `WiFi.h`/`Arduino.h` (like `SoilMoistureSensor`),
so it's excluded from the `native` PlatformIO environment (see
`platformio.ini`'s `lib_ignore`) and can only be verified on real hardware.
The one piece of non-trivial logic it relies on — the retry-delay timing —
is factored into `RetryTimer`, which *is* natively unit-tested.

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

## Project layout

```
firmware/
  platformio.ini                    PlatformIO project + board/test environments
  src/main.cpp                      Entry point (setup/loop) — demonstrates usage
  lib/SoilMoistureSensor/            Reads + filters the raw sensor value (needs Arduino/hardware)
  lib/MoistureCalibration/           Converts raw → percent (pure logic, natively testable)
  lib/RetryTimer/                    Overflow-safe "should retry now" timing (pure logic, natively testable)
  lib/WifiService/                   Non-blocking Wi-Fi connect/reconnect + redacted logging (needs Arduino/hardware)
  lib/UuidV4/                        UUID v4 formatting from given random bytes (pure logic, natively testable)
  lib/Iso8601/                       Epoch seconds → ISO 8601 UTC string (pure logic, natively testable)
  lib/FirmwareReading/               API-compatible reading struct + ArduinoJson serializer (pure logic, natively testable)
  test/test_moisture_calibration/    Unit tests for MoistureCalibration (`pio test -e native`)
  test/test_retry_timer/             Unit tests for RetryTimer (`pio test -e native`)
  test/test_uuid_v4/                 Unit tests for UuidV4 (`pio test -e native`)
  test/test_iso8601/                 Unit tests for Iso8601 (`pio test -e native`)
  test/test_firmware_reading/        Unit tests for FirmwareReading (`pio test -e native`)
```
