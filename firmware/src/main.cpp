#include <Arduino.h>
#include "SoilMoistureSensor.h"
#include "MoistureCalibration.h"

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

// Centralized calibration reference points — the single place these
// numbers live. Change them here once real hardware is calibrated; no
// other file needs to change. (A future ticket will sync these from the
// backend's Calibration API instead of a compile-time constant.)
constexpr MoistureCalibration soilCalibration{/* dryValue= */ 3000, /* wetValue= */ 1200};

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

  // Checked once up front so a misconfigured calibration is loud and
  // obvious at startup — convertToMoisturePercent() also re-checks this on
  // every call, so a bad calibration can never silently produce a
  // meaningless percentage even if this warning goes unnoticed.
  if (!soilCalibration.isValid()) {
    Serial.println("*** WARNING: soilCalibration is invalid (dryValue and wetValue must be "
                    "distinct and within 0-4095). Moisture percentages will not be computed "
                    "until this is fixed. ***");
  }
}

void loop() {
  SoilMoistureSample sample = soilSensor.read();

  // The correct usage pattern: always check success before touching
  // rawValue. A failed read must never be treated as real data — there is
  // deliberately no code path here that falls back to a fabricated number.
  if (!sample.success) {
    Serial.printf("Reading FAILED: %s\n", sample.errorMessage);
    delay(LOOP_DELAY_MS);
    return;
  }

  MoistureReading moisture = convertToMoisturePercent(sample.rawValue, soilCalibration);

  if (moisture.success) {
    Serial.printf("Reading OK: rawMoisture=%d moisturePercent=%.1f\n", moisture.rawValue,
                  moisture.moisturePercent);
  } else {
    // The raw value is still valid and available here (moisture.rawValue)
    // even though no percentage could be computed — it's just not shown
    // in this demo log line, since there's nothing to report yet without
    // a working calibration.
    Serial.printf("Conversion FAILED: %s (rawMoisture=%d preserved)\n", moisture.errorMessage,
                  moisture.rawValue);
  }

  delay(LOOP_DELAY_MS);
}
