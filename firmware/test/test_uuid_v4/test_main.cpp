#include <unity.h>

#include <cstdint>
#include <cstring>

#include "UuidV4.h"

void setUp() {}
void tearDown() {}

void test_length_is_36_characters() {
  uint8_t bytes[16] = {0};
  char out[UUID_V4_STRING_LENGTH + 1];
  formatUuidV4(bytes, out);
  TEST_ASSERT_EQUAL(36, strlen(out));
}

void test_all_zero_bytes_forces_version_and_variant() {
  uint8_t bytes[16] = {0};
  char out[UUID_V4_STRING_LENGTH + 1];
  formatUuidV4(bytes, out);
  TEST_ASSERT_EQUAL_STRING("00000000-0000-4000-8000-000000000000", out);
}

void test_all_ff_bytes_forces_version_and_variant() {
  uint8_t bytes[16];
  memset(bytes, 0xFF, sizeof(bytes));
  char out[UUID_V4_STRING_LENGTH + 1];
  formatUuidV4(bytes, out);
  TEST_ASSERT_EQUAL_STRING("ffffffff-ffff-4fff-bfff-ffffffffffff", out);
}

void test_dashes_and_version_variant_at_expected_positions() {
  uint8_t bytes[16];
  for (int i = 0; i < 16; i++) bytes[i] = static_cast<uint8_t>(i * 17);
  char out[UUID_V4_STRING_LENGTH + 1];
  formatUuidV4(bytes, out);

  TEST_ASSERT_EQUAL('-', out[8]);
  TEST_ASSERT_EQUAL('-', out[13]);
  TEST_ASSERT_EQUAL('-', out[18]);
  TEST_ASSERT_EQUAL('-', out[23]);
  TEST_ASSERT_EQUAL('4', out[14]);

  char variantNibble = out[19];
  TEST_ASSERT_TRUE(variantNibble == '8' || variantNibble == '9' || variantNibble == 'a' ||
                    variantNibble == 'b');
}

void test_lowercase_hex_output() {
  uint8_t bytes[16];
  memset(bytes, 0xAB, sizeof(bytes));
  char out[UUID_V4_STRING_LENGTH + 1];
  formatUuidV4(bytes, out);

  for (size_t i = 0; i < strlen(out); i++) {
    char c = out[i];
    TEST_ASSERT_FALSE(c >= 'A' && c <= 'F');
  }
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_length_is_36_characters);
  RUN_TEST(test_all_zero_bytes_forces_version_and_variant);
  RUN_TEST(test_all_ff_bytes_forces_version_and_variant);
  RUN_TEST(test_dashes_and_version_variant_at_expected_positions);
  RUN_TEST(test_lowercase_hex_output);
  return UNITY_END();
}
