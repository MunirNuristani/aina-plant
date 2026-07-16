#include <unity.h>
#include <cstdint>
#include "RetryTimer.h"

void setUp() {}
void tearDown() {}

void test_not_enough_time_elapsed_returns_false() {
  TEST_ASSERT_FALSE(shouldRetryNow(1000, 900, 500));
}

void test_exactly_enough_time_elapsed_returns_true() {
  TEST_ASSERT_TRUE(shouldRetryNow(1400, 900, 500));
}

void test_more_than_enough_time_elapsed_returns_true() {
  TEST_ASSERT_TRUE(shouldRetryNow(5000, 900, 500));
}

void test_zero_delay_always_ready_to_retry() {
  TEST_ASSERT_TRUE(shouldRetryNow(1000, 1000, 0));
}

void test_handles_millis_rollover() {
  // lastAttemptMs is 100 before UINT32_MAX. Going from there up to
  // UINT32_MAX is 100 steps, and wrapping UINT32_MAX -> 0 is one more
  // step, then another 50 to reach nowMs — real elapsed time is
  // 100 + 1 + 50 = 151ms, even though nowMs is numerically far smaller
  // than lastAttemptMs.
  uint32_t lastAttemptMs = UINT32_MAX - 100;
  uint32_t nowMs = 50;

  TEST_ASSERT_TRUE(shouldRetryNow(nowMs, lastAttemptMs, 151));
  TEST_ASSERT_FALSE(shouldRetryNow(nowMs, lastAttemptMs, 152));
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_not_enough_time_elapsed_returns_false);
  RUN_TEST(test_exactly_enough_time_elapsed_returns_true);
  RUN_TEST(test_more_than_enough_time_elapsed_returns_true);
  RUN_TEST(test_zero_delay_always_ready_to_retry);
  RUN_TEST(test_handles_millis_rollover);
  return UNITY_END();
}
