#include <unity.h>

#include "Iso8601.h"

void setUp() {}
void tearDown() {}

void test_epoch_zero_is_1970_01_01() {
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(0, out);
  TEST_ASSERT_EQUAL_STRING("1970-01-01T00:00:00Z", out);
}

void test_year_2000() {
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(946684800UL, out);
  TEST_ASSERT_EQUAL_STRING("2000-01-01T00:00:00Z", out);
}

void test_year_2020() {
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(1577836800UL, out);
  TEST_ASSERT_EQUAL_STRING("2020-01-01T00:00:00Z", out);
}

void test_leap_day_2024() {
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(1709164800UL, out);
  TEST_ASSERT_EQUAL_STRING("2024-02-29T00:00:00Z", out);
}

void test_y2038_boundary_still_correct() {
  // The classic signed-32-bit time_t overflow point -- this module takes
  // uint32_t, not time_t, specifically so dates past this point (up to
  // year 2106) still format correctly instead of wrapping negative.
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(2147483647UL, out);
  TEST_ASSERT_EQUAL_STRING("2038-01-19T03:14:07Z", out);
}

void test_max_uint32_epoch() {
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(4294967295UL, out);
  TEST_ASSERT_EQUAL_STRING("2106-02-07T06:28:15Z", out);
}

void test_time_of_day_formatting() {
  char out[ISO8601_UTC_STRING_LENGTH + 1];
  formatIso8601Utc(1784196000UL, out);  // 2026-07-16T10:00:00Z
  TEST_ASSERT_EQUAL_STRING("2026-07-16T10:00:00Z", out);
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_epoch_zero_is_1970_01_01);
  RUN_TEST(test_year_2000);
  RUN_TEST(test_year_2020);
  RUN_TEST(test_leap_day_2024);
  RUN_TEST(test_y2038_boundary_still_correct);
  RUN_TEST(test_max_uint32_epoch);
  RUN_TEST(test_time_of_day_formatting);
  return UNITY_END();
}
