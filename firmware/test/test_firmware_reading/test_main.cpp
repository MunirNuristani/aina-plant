#include <unity.h>

#include <ArduinoJson.h>
#include <cstring>

#include "FirmwareReading.h"

void setUp() {}
void tearDown() {}

FirmwareReading makeSampleReading() {
  FirmwareReading reading{};
  strcpy(reading.readingId, "11111111-1111-4111-8111-111111111111");
  strcpy(reading.deviceId, "22222222-2222-4222-8222-222222222222");
  strcpy(reading.recordedAt, "2026-07-16T10:00:00Z");
  reading.rawMoisture = 2048;
  reading.moisturePercent = 45.5f;
  strcpy(reading.firmwareVersion, "1.2.3");
  reading.hasWifiRssi = true;
  reading.wifiRssi = -63;
  return reading;
}

void test_serializes_all_fields_matching_the_api_contract() {
  FirmwareReading reading = makeSampleReading();
  char out[FIRMWARE_READING_JSON_BUFFER_SIZE];
  size_t len = serializeFirmwareReading(reading, out, sizeof(out));
  TEST_ASSERT_GREATER_THAN(0, len);

  JsonDocument parsed;
  DeserializationError err = deserializeJson(parsed, out);
  TEST_ASSERT_FALSE(err);

  TEST_ASSERT_EQUAL_STRING("11111111-1111-4111-8111-111111111111",
                            parsed["readingId"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("22222222-2222-4222-8222-222222222222",
                            parsed["deviceId"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("2026-07-16T10:00:00Z", parsed["recordedAt"].as<const char*>());
  TEST_ASSERT_EQUAL_INT(2048, parsed["rawMoisture"].as<int>());
  TEST_ASSERT_EQUAL_FLOAT(45.5f, parsed["moisturePercent"].as<float>());
  TEST_ASSERT_EQUAL_STRING("1.2.3", parsed["firmwareVersion"].as<const char*>());
  TEST_ASSERT_EQUAL_INT(-63, parsed["wifiRssi"].as<int>());
}

void test_omits_firmware_version_key_when_not_set() {
  FirmwareReading reading = makeSampleReading();
  reading.firmwareVersion[0] = '\0';
  char out[FIRMWARE_READING_JSON_BUFFER_SIZE];
  size_t len = serializeFirmwareReading(reading, out, sizeof(out));
  TEST_ASSERT_GREATER_THAN(0, len);

  JsonDocument parsed;
  deserializeJson(parsed, out);
  TEST_ASSERT_FALSE(parsed["firmwareVersion"].is<const char*>());
}

void test_omits_wifi_rssi_key_when_not_available() {
  FirmwareReading reading = makeSampleReading();
  reading.hasWifiRssi = false;
  char out[FIRMWARE_READING_JSON_BUFFER_SIZE];
  size_t len = serializeFirmwareReading(reading, out, sizeof(out));
  TEST_ASSERT_GREATER_THAN(0, len);

  JsonDocument parsed;
  deserializeJson(parsed, out);
  TEST_ASSERT_FALSE(parsed["wifiRssi"].is<int>());
}

void test_returns_zero_when_buffer_too_small() {
  FirmwareReading reading = makeSampleReading();
  char out[8];  // far too small to hold the serialized JSON
  size_t len = serializeFirmwareReading(reading, out, sizeof(out));
  TEST_ASSERT_EQUAL(0, len);
}

void test_required_fields_always_present_even_with_no_optionals() {
  FirmwareReading reading = makeSampleReading();
  reading.firmwareVersion[0] = '\0';
  reading.hasWifiRssi = false;
  char out[FIRMWARE_READING_JSON_BUFFER_SIZE];
  size_t len = serializeFirmwareReading(reading, out, sizeof(out));
  TEST_ASSERT_GREATER_THAN(0, len);

  JsonDocument parsed;
  deserializeJson(parsed, out);
  TEST_ASSERT_TRUE(parsed["readingId"].is<const char*>());
  TEST_ASSERT_TRUE(parsed["deviceId"].is<const char*>());
  TEST_ASSERT_TRUE(parsed["recordedAt"].is<const char*>());
  TEST_ASSERT_TRUE(parsed["rawMoisture"].is<int>());
  TEST_ASSERT_TRUE(parsed["moisturePercent"].is<float>());
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_serializes_all_fields_matching_the_api_contract);
  RUN_TEST(test_omits_firmware_version_key_when_not_set);
  RUN_TEST(test_omits_wifi_rssi_key_when_not_available);
  RUN_TEST(test_returns_zero_when_buffer_too_small);
  RUN_TEST(test_required_fields_always_present_even_with_no_optionals);
  return UNITY_END();
}
