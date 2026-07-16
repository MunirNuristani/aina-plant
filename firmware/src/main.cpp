#include <Arduino.h>
#include "SoilMoistureSensor.h"

// GPIO34: an ADC1-capable, input-only pin — ADC1 (unlike ADC2) stays usable
// even once Wi-Fi is active, which matters once this firmware starts
// reporting readings to the backend over Wi-Fi. Change this single
// constant to rewire the sensor to a different pin; nothing else in this
// file or in SoilMoistureSensor needs to change.
constexpr uint8_t SOIL_SENSOR_PIN = 34;

// How many raw samples make up one filtered reading, and how far apart
// they're spaced. 10 samples was chosen as enough to make the median
// filter meaningfully resistant to a single noisy/outlier sample, without
// taking so long that one reading cycle noticeably delays the device's
// reporting interval. 15ms between samples lets the ADC and the sensor's
// own analog output settle between reads, rather than sampling faster
// than the signal can actually change. Both are tunable once real
// hardware is available to measure actual noise characteristics.
constexpr uint8_t SOIL_SENSOR_SAMPLE_COUNT = 10;
constexpr uint16_t SOIL_SENSOR_SAMPLE_DELAY_MS = 15;

// Time between full reading cycles in the demo loop below. The real
// device's actual reporting interval is a separate, server-side-configured
// concept (Device.reportingIntervalSeconds in the backend) — this is just
// a local main-loop demo pace, not a design decision that comes with any
// networking behavior yet.
constexpr unsigned long LOOP_DELAY_MS = 5000;

SoilMoistureSensor soilSensor(SOIL_SENSOR_PIN, SOIL_SENSOR_SAMPLE_COUNT, SOIL_SENSOR_SAMPLE_DELAY_MS);

void setup() {
  Serial.begin(115200);
  delay(500); // let the serial monitor attach before the first log line
  soilSensor.begin();
}

void loop() {
  SoilMoistureSample sample = soilSensor.read();

  // The correct usage pattern: always check success before touching
  // rawValue. A failed read must never be treated as real data — there is
  // deliberately no code path here that falls back to a fabricated number.
  if (sample.success) {
    Serial.printf("Reading OK: rawMoisture=%d\n", sample.rawValue);
  } else {
    Serial.printf("Reading FAILED: %s\n", sample.errorMessage);
  }

  delay(LOOP_DELAY_MS);
}
