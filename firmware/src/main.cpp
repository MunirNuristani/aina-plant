#include <Arduino.h>
#include <esp_random.h>
#include <time.h>
#include <cstring>
#include "SoilMoistureSensor.h"
#include "MoistureCalibration.h"
#include "WifiService.h"
#include "FirmwareReading.h"

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

// Placeholders — fill in with the real network's credentials before
// flashing. Never commit real credentials here: this file is tracked in
// git, and WifiService only ever logs a masked SSID / redacts the
// password (see lib/WifiService/), but the plaintext values themselves are
// still whatever ends up in this source file.
constexpr const char* WIFI_SSID = "YOUR_SSID";
constexpr const char* WIFI_PASSWORD = "YOUR_PASSWORD";

// Placeholder — replace with this device's real Device.id (a UUID) as
// returned by the backend's device registration endpoint
// (POST /api/v1/devices). This is deliberately NOT the same value as
// whatever identifier the device authenticates with (X-Device-Id) — see
// FirmwareReading.h's deviceId field comment for why they differ.
constexpr const char* DEVICE_ID = "00000000-0000-0000-0000-000000000000";
constexpr const char* FIRMWARE_VERSION = "1.0.0";

// Anything before this means the ESP32's clock hasn't received NTP time
// yet (it boots at epoch 0) — used to detect "not synced" rather than
// reporting a bogus 1970 timestamp. 2024-01-01T00:00:00Z; arbitrary other
// than being comfortably before any real deployment and comfortably after
// epoch 0.
constexpr time_t PLAUSIBLE_MIN_EPOCH = 1704067200;

SoilMoistureSensor soilSensor(SOIL_SENSOR_PIN, SOIL_SENSOR_SAMPLE_COUNT, SOIL_SENSOR_SAMPLE_DELAY_MS);
WifiService wifiService(WIFI_SSID, WIFI_PASSWORD);
bool ntpSyncStarted = false;

// Thin glue around the ESP32's hardware RNG (esp_random(), part of the
// ESP-IDF, not a library worth wrapping any further) plus UuidV4's pure
// formatter. Lives here rather than in a lib/ module because there's no
// logic in it worth unit-testing separately from formatUuidV4() itself,
// which already is (see test/test_uuid_v4/).
void generateReadingId(char out[UUID_V4_STRING_LENGTH + 1]) {
  uint8_t randomBytes[16];
  for (int i = 0; i < 4; i++) {
    uint32_t word = esp_random();
    memcpy(randomBytes + i * 4, &word, sizeof(word));
  }
  formatUuidV4(randomBytes, out);
}

void setup() {
  Serial.begin(115200);
  delay(500); // let the serial monitor attach before the first log line
  soilSensor.begin();
  wifiService.begin();

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
  // Drives connect/reconnect/logging — never blocks, safe to call every
  // iteration regardless of how long the rest of loop() takes.
  wifiService.update();

  // Kicked off once, as soon as Wi-Fi first connects — SNTP then syncs
  // asynchronously in the background; time(nullptr) starts returning real
  // wall-clock time once that finishes (checked below via
  // PLAUSIBLE_MIN_EPOCH), typically within a few seconds.
  if (wifiService.isConnected() && !ntpSyncStarted) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    ntpSyncStarted = true;
    Serial.println("[main] NTP sync started");
  }

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

  if (!moisture.success) {
    // The raw value is still valid and available here (moisture.rawValue)
    // even though no percentage could be computed — it's just not shown
    // in this demo log line, since there's nothing to report yet without
    // a working calibration.
    Serial.printf("Conversion FAILED: %s (rawMoisture=%d preserved)\n", moisture.errorMessage,
                  moisture.rawValue);
    delay(LOOP_DELAY_MS);
    return;
  }

  Serial.printf("Reading OK: rawMoisture=%d moisturePercent=%.1f\n", moisture.rawValue,
                moisture.moisturePercent);

  time_t now = time(nullptr);
  if (now < PLAUSIBLE_MIN_EPOCH) {
    Serial.println("[main] Skipping reading payload: time not yet synced (NTP pending)");
    delay(LOOP_DELAY_MS);
    return;
  }

  FirmwareReading reading{};
  generateReadingId(reading.readingId);
  strncpy(reading.deviceId, DEVICE_ID, sizeof(reading.deviceId) - 1);
  formatIso8601Utc(static_cast<uint32_t>(now), reading.recordedAt);
  reading.rawMoisture = moisture.rawValue;
  reading.moisturePercent = moisture.moisturePercent;
  strncpy(reading.firmwareVersion, FIRMWARE_VERSION, sizeof(reading.firmwareVersion) - 1);
  reading.hasWifiRssi = wifiService.isConnected();
  reading.wifiRssi = WiFi.RSSI();

  char json[FIRMWARE_READING_JSON_BUFFER_SIZE];
  size_t len = serializeFirmwareReading(reading, json, sizeof(json));
  if (len > 0) {
    Serial.print("[main] Reading JSON: ");
    Serial.println(json);
  } else {
    Serial.println("[main] Reading JSON serialization failed (buffer too small)");
  }

  delay(LOOP_DELAY_MS);
}
