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

pio run                  # compile
pio run --target upload  # flash to a connected ESP32
pio device monitor       # view Serial output (115200 baud)
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

## Project layout

```
firmware/
  platformio.ini              PlatformIO project + board configuration
  src/main.cpp                 Entry point (setup/loop) — demonstrates usage
  lib/SoilMoistureSensor/       The sensor module (this is the "dedicated module")
```
