#include "FirmwareReading.h"

#include <ArduinoJson.h>

size_t serializeFirmwareReading(const FirmwareReading& reading, char* out, size_t outSize) {
  JsonDocument doc;

  doc["readingId"] = reading.readingId;
  doc["deviceId"] = reading.deviceId;
  doc["recordedAt"] = reading.recordedAt;
  doc["rawMoisture"] = reading.rawMoisture;
  doc["moisturePercent"] = reading.moisturePercent;

  if (reading.firmwareVersion[0] != '\0') {
    doc["firmwareVersion"] = reading.firmwareVersion;
  }
  if (reading.hasWifiRssi) {
    doc["wifiRssi"] = reading.wifiRssi;
  }

  // measureJson() first, rather than trusting serializeJson()'s return
  // value alone, so a too-small buffer is reported as a clean failure (0)
  // instead of silently handing back truncated (invalid) JSON.
  const size_t needed = measureJson(doc) + 1;  // +1 for the null terminator
  if (needed > outSize) {
    return 0;
  }

  return serializeJson(doc, out, outSize);
}
