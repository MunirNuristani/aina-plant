#pragma once

#include <Arduino.h>

// ESP32's built-in ADC is 12-bit: readings range 0-4095. This matches the
// backend's rawMoisture / calibration value range exactly (see
// backend/src/validation/reading.ts and calibration.ts) — the two ends of
// this system deliberately share the same raw-ADC domain.
constexpr int SOIL_SENSOR_ADC_MAX = 4095;

// Upper bound on sampleCount (see the constructor below), so read() can use
// a small fixed-size stack buffer instead of a variable-length array —
// generously above any sampleCount this project actually uses (default 10).
constexpr uint8_t SOIL_SENSOR_MAX_SAMPLE_COUNT = 32;

struct SoilMoistureSample {
  // false if the read failed (see SoilMoistureSensor::read()) — callers
  // must check this before using rawValue. A failed read never produces a
  // fabricated number: rawValue is meaningless when success is false.
  bool success;
  int rawValue;
  const char* errorMessage;
};

// Reads a capacitive soil moisture sensor on a single analog pin, taking
// several samples per reading and combining them into one filtered value.
//
// This class owns only the "read one filtered raw value" concern. It knows
// nothing about calibration, percentages, Wi-Fi, or the backend API —
// those are separate concerns, layered on top of this module elsewhere.
class SoilMoistureSensor {
public:
  // pin: the ADC-capable GPIO this sensor's signal wire is connected to.
  //   Passed in here (not hardcoded in this module) so the same class can
  //   be reused for multiple sensors on different pins; the composition
  //   root (main.cpp) is the one place that decides which pin is used.
  // sampleCount: number of raw ADC samples taken per reading. Clamped to
  //   SOIL_SENSOR_MAX_SAMPLE_COUNT in the constructor.
  // sampleDelayMs: delay between samples, in milliseconds.
  // maxSampleSpread: if (max sample - min sample) exceeds this, the
  //   reading is treated as unstable/noisy and reported as a failure
  //   rather than being averaged into a misleading number.
  explicit SoilMoistureSensor(uint8_t pin, uint8_t sampleCount = 10, uint16_t sampleDelayMs = 15,
                               int maxSampleSpread = 500);

  // Configures the pin and ADC resolution. Call once from setup().
  void begin();

  // Takes sampleCount readings (sampleDelayMs apart), and returns their
  // median as one filtered raw value — or a failure result if the samples
  // look implausible (see the .cpp for exactly what's checked). Logs
  // every read attempt and its outcome to Serial.
  SoilMoistureSample read();

private:
  uint8_t pin_;
  uint8_t sampleCount_;
  uint16_t sampleDelayMs_;
  int maxSampleSpread_;

  int computeMedian(int* samples, uint8_t count) const;
};
