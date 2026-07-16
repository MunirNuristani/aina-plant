#pragma once

#include <cstddef>

#include "Iso8601.h"
#include "UuidV4.h"

// Fixed-size buffers only -- no dynamic allocation, no Arduino String --
// so this struct and its serializer have no Arduino dependency and can be
// unit-tested on the host machine (see test/test_firmware_reading/),
// mirroring MoistureCalibration's split from the hardware-touching
// modules that produce its inputs (SoilMoistureSensor, WifiService).
//
// This struct only *holds* an already-assembled reading -- generating its
// values (a random reading ID, the current epoch time, a live RSSI
// reading) is the caller's job (main.cpp), using UuidV4/Iso8601's pure
// formatters plus real hardware sources (esp_random(), NTP-synced
// time(nullptr), WiFi.RSSI()).

// Room for "1.2.3-prerelease+build" style versions with margin to spare --
// see FIRMWARE_VERSION_PATTERN in backend/src/validation/reading.ts for
// the format this must satisfy.
constexpr size_t FIRMWARE_VERSION_BUFFER_SIZE = 32;

// A conservative upper bound for serializeFirmwareReading()'s output
// buffer -- comfortably covers every field at max length (two 36-char
// UUIDs, a 20-char timestamp, a 31-char firmware version, plus JSON
// punctuation) with margin to spare.
constexpr size_t FIRMWARE_READING_JSON_BUFFER_SIZE = 320;

struct FirmwareReading {
  // Generated once when the reading is captured (see main.cpp) and never
  // regenerated for the same physical reading -- this is what makes it a
  // *stable* ID: a retried submission of this same struct reuses the same
  // readingId, which is what lets the backend's idempotent-retry handling
  // (see reading-service.ts's duplicate-readingId path) recognize a retry
  // as the same reading rather than creating a second row.
  char readingId[UUID_V4_STRING_LENGTH + 1];

  // The device's server-assigned UUID (Device.id in the backend) -- NOT
  // the human-chosen `identifier` string used for the X-Device-Id auth
  // header. The backend's ingestReading() checks this field against the
  // *authenticated* device's id, not its identifier (see
  // backend/src/services/reading-service.ts).
  char deviceId[UUID_V4_STRING_LENGTH + 1];

  // ISO 8601 UTC, e.g. "2026-07-16T10:00:00Z" -- when the reading was
  // actually measured, not when it's sent/received; the backend tracks
  // receipt time separately as receivedAt, generated server-side.
  char recordedAt[ISO8601_UTC_STRING_LENGTH + 1];

  // Raw ADC value (0-4095) -- see SoilMoistureSensor.
  int rawMoisture;

  // Calibrated percentage (0-100) -- see MoistureCalibration.
  float moisturePercent;

  // Empty string ("") if not set -- serializeFirmwareReading() omits the
  // firmwareVersion key entirely in that case, matching the backend's
  // `.optional()` field (an omitted key, not an empty string or null, is
  // what zod's .optional() expects).
  char firmwareVersion[FIRMWARE_VERSION_BUFFER_SIZE];

  // Wi-Fi signal strength (dBm, typically -100 to 0) at the time of the
  // reading. hasWifiRssi false means "not available" (e.g. captured
  // before Wi-Fi connected) -- wifiRssi is meaningless in that case, and
  // serializeFirmwareReading() omits the key entirely rather than writing
  // a fabricated 0.
  bool hasWifiRssi;
  int wifiRssi;
};

// Serializes `reading` into `out` as a JSON object matching the backend's
// sensorReadingSchema field-for-field (see
// backend/src/validation/reading.ts): readingId, deviceId, recordedAt,
// rawMoisture, moisturePercent, and -- only when present -- firmwareVersion
// and wifiRssi.
//
// Returns the number of bytes written (excluding the null terminator), or
// 0 if `out` (outSize bytes) was too small to hold the serialized JSON --
// never a truncated, invalid payload.
size_t serializeFirmwareReading(const FirmwareReading& reading, char* out, size_t outSize);
