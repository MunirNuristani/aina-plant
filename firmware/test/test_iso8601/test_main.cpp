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

void test_civil_date_time_matches_formatted_string() {
  // Same reference value as test_time_of_day_formatting -- proves
  // toCivilDateTime() and formatIso8601Utc() agree, since they share the
  // same underlying calendar math.
  CivilDateTime dt = toCivilDateTime(1784196000UL);
  TEST_ASSERT_EQUAL(2026, dt.year);
  TEST_ASSERT_EQUAL(7, dt.month);
  TEST_ASSERT_EQUAL(16, dt.day);
  TEST_ASSERT_EQUAL(10, dt.hour);
  TEST_ASSERT_EQUAL(0, dt.minute);
  TEST_ASSERT_EQUAL(0, dt.second);
}

void test_civil_date_time_epoch_zero() {
  CivilDateTime dt = toCivilDateTime(0);
  TEST_ASSERT_EQUAL(1970, dt.year);
  TEST_ASSERT_EQUAL(1, dt.month);
  TEST_ASSERT_EQUAL(1, dt.day);
  TEST_ASSERT_EQUAL(0, dt.hour);
  TEST_ASSERT_EQUAL(0, dt.minute);
  TEST_ASSERT_EQUAL(0, dt.second);
}

void test_civil_date_time_nonzero_time_of_day() {
  // 2026-01-01T00:00:00Z (1767225600, cross-validated against
  // 2024-01-01T00:00:00Z=1704067200 via two years' elapsed days -- see
  // FirmwareReading ticket history) plus 15:04:05 of that same day.
  CivilDateTime dt = toCivilDateTime(1767225600UL + 15UL * 3600 + 4UL * 60 + 5UL);
  TEST_ASSERT_EQUAL(2026, dt.year);
  TEST_ASSERT_EQUAL(1, dt.month);
  TEST_ASSERT_EQUAL(1, dt.day);
  TEST_ASSERT_EQUAL(15, dt.hour);
  TEST_ASSERT_EQUAL(4, dt.minute);
  TEST_ASSERT_EQUAL(5, dt.second);
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
  RUN_TEST(test_civil_date_time_matches_formatted_string);
  RUN_TEST(test_civil_date_time_epoch_zero);
  RUN_TEST(test_civil_date_time_nonzero_time_of_day);
  return UNITY_END();
}
