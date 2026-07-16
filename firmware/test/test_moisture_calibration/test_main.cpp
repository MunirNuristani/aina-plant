#include <unity.h>
#include "MoistureCalibration.h"

void setUp() {}
void tearDown() {}

void test_valid_calibration_accepted() {
  MoistureCalibration cal{3000, 1200};
  TEST_ASSERT_TRUE(cal.isValid());
}

void test_equal_dry_wet_rejected() {
  MoistureCalibration cal{2000, 2000};
  TEST_ASSERT_FALSE(cal.isValid());
}

void test_out_of_range_dry_rejected() {
  MoistureCalibration cal{5000, 1200};
  TEST_ASSERT_FALSE(cal.isValid());
}

void test_out_of_range_wet_rejected() {
  MoistureCalibration cal{3000, -1};
  TEST_ASSERT_FALSE(cal.isValid());
}

void test_conversion_at_dry_end_is_zero_percent() {
  MoistureCalibration cal{3000, 1200};
  MoistureReading r = convertToMoisturePercent(3000, cal);
  TEST_ASSERT_TRUE(r.success);
  TEST_ASSERT_EQUAL_INT(3000, r.rawValue);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, r.moisturePercent);
}

void test_conversion_at_wet_end_is_100_percent() {
  MoistureCalibration cal{3000, 1200};
  MoistureReading r = convertToMoisturePercent(1200, cal);
  TEST_ASSERT_TRUE(r.success);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 100.0f, r.moisturePercent);
}

void test_conversion_at_midpoint_is_50_percent() {
  MoistureCalibration cal{3000, 1200};
  MoistureReading r = convertToMoisturePercent(2100, cal); // midpoint of 1200-3000
  TEST_ASSERT_TRUE(r.success);
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 50.0f, r.moisturePercent);
}

void test_conversion_clamps_below_zero() {
  MoistureCalibration cal{3000, 1200};
  MoistureReading r = convertToMoisturePercent(3500, cal); // beyond the dry end
  TEST_ASSERT_TRUE(r.success);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, r.moisturePercent);
}

void test_conversion_clamps_above_100() {
  MoistureCalibration cal{3000, 1200};
  MoistureReading r = convertToMoisturePercent(1000, cal); // beyond the wet end
  TEST_ASSERT_TRUE(r.success);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 100.0f, r.moisturePercent);
}

void test_conversion_works_with_inverted_calibration() {
  // Some sensors/wirings read LOW when dry and HIGH when wet — the
  // conversion must still work when wetValue > dryValue.
  MoistureCalibration cal{1200, 3000};
  MoistureReading dry = convertToMoisturePercent(1200, cal);
  MoistureReading wet = convertToMoisturePercent(3000, cal);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, dry.moisturePercent);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 100.0f, wet.moisturePercent);
}

void test_invalid_calibration_fails_but_preserves_raw_value() {
  MoistureCalibration cal{2000, 2000}; // invalid: equal
  MoistureReading r = convertToMoisturePercent(1500, cal);
  TEST_ASSERT_FALSE(r.success);
  TEST_ASSERT_EQUAL_INT(1500, r.rawValue);
  TEST_ASSERT_NOT_NULL(r.errorMessage);
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_valid_calibration_accepted);
  RUN_TEST(test_equal_dry_wet_rejected);
  RUN_TEST(test_out_of_range_dry_rejected);
  RUN_TEST(test_out_of_range_wet_rejected);
  RUN_TEST(test_conversion_at_dry_end_is_zero_percent);
  RUN_TEST(test_conversion_at_wet_end_is_100_percent);
  RUN_TEST(test_conversion_at_midpoint_is_50_percent);
  RUN_TEST(test_conversion_clamps_below_zero);
  RUN_TEST(test_conversion_clamps_above_100);
  RUN_TEST(test_conversion_works_with_inverted_calibration);
  RUN_TEST(test_invalid_calibration_fails_but_preserves_raw_value);
  return UNITY_END();
}
