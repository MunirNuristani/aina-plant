#include <unity.h>
#include <cstdint>
#include "ProvisioningTrigger.h"

void setUp() {}
void tearDown() {}

void test_below_threshold_returns_false() {
  TEST_ASSERT_FALSE(shouldEnterProvisioningMode(9, 10));
}

void test_at_threshold_returns_true() {
  TEST_ASSERT_TRUE(shouldEnterProvisioningMode(10, 10));
}

void test_above_threshold_returns_true() {
  TEST_ASSERT_TRUE(shouldEnterProvisioningMode(11, 10));
}

void test_zero_failures_below_nonzero_threshold_returns_false() {
  TEST_ASSERT_FALSE(shouldEnterProvisioningMode(0, 10));
}

void test_zero_threshold_always_triggers() {
  TEST_ASSERT_TRUE(shouldEnterProvisioningMode(0, 0));
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_below_threshold_returns_false);
  RUN_TEST(test_at_threshold_returns_true);
  RUN_TEST(test_above_threshold_returns_true);
  RUN_TEST(test_zero_failures_below_nonzero_threshold_returns_false);
  RUN_TEST(test_zero_threshold_always_triggers);
  return UNITY_END();
}
