#pragma once

// Deliberately has no Arduino dependency (unlike SoilMoistureSensor) — this
// is pure conversion logic, so it can be unit-tested on the host machine
// via PlatformIO's "native" environment (see test/ and platformio.ini),
// without needing real hardware or the ESP32 toolchain.

// Same raw-ADC domain as SoilMoistureSensor's SOIL_SENSOR_ADC_MAX and the
// backend's rawMoisture/calibration values (see backend/src/validation/).
// Duplicated here (rather than shared) specifically to keep this module
// free of any dependency on SoilMoistureSensor.h (and therefore Arduino.h).
constexpr int MOISTURE_ADC_MAX = 4095;

// A device's calibration reference points: the raw ADC value read when
// fully dry, and when fully wet. Centralizing these as one small struct
// (constructed once, e.g. in main.cpp) is what "configurable calibration"
// means here — change the two numbers in one place, nothing else in the
// firmware needs to change.
struct MoistureCalibration {
  int dryValue;
  int wetValue;

  // Both values must be within the ADC's real range, and distinct (equal
  // values would make the conversion's denominator zero) — mirrors the
  // backend's Calibration validation (see backend/src/validation/calibration.ts).
  bool isValid() const {
    bool dryInRange = dryValue >= 0 && dryValue <= MOISTURE_ADC_MAX;
    bool wetInRange = wetValue >= 0 && wetValue <= MOISTURE_ADC_MAX;
    return dryInRange && wetInRange && dryValue != wetValue;
  }
};

struct MoistureReading {
  // false if the calibration was invalid — checked on every call, not
  // just once at startup, so this function can never silently produce a
  // meaningless percentage no matter how it's called.
  bool success;

  // Always set, regardless of success — the raw reading is preserved
  // even when the percentage can't be computed.
  int rawValue;

  // Valid only when success is true. Always clamped to [0, 100] even if
  // rawValue falls outside the calibrated dry/wet range (e.g. the sensor
  // needs recalibrating, or briefly reads past its calibrated bounds).
  float moisturePercent;

  // Set only when success is false.
  const char* errorMessage;
};

// Converts a raw ADC reading into a moisture percentage using the given
// calibration. Works whether dryValue > wetValue (the common case for
// most capacitive sensors) or dryValue < wetValue (some sensors/wirings
// read the other way) — the interpolation is symmetric either way.
MoistureReading convertToMoisturePercent(int rawValue, const MoistureCalibration& calibration);
