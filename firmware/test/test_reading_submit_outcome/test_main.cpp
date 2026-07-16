#include <unity.h>

#include "ReadingSubmitOutcome.h"

void setUp() {}
void tearDown() {}

void test_201_created_is_success_not_duplicate() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(
      201,
      R"({"readingId":"x","status":"created","recordedAt":"2026-01-01T00:00:00Z","receivedAt":"2026-01-01T00:00:01Z"})");
  TEST_ASSERT_TRUE(outcome.success);
  TEST_ASSERT_FALSE(outcome.isDuplicate);
}

void test_200_duplicate_is_success_and_duplicate() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(
      200,
      R"({"readingId":"x","status":"duplicate","recordedAt":"2026-01-01T00:00:00Z","receivedAt":"2026-01-01T00:00:01Z"})");
  TEST_ASSERT_TRUE(outcome.success);
  TEST_ASSERT_TRUE(outcome.isDuplicate);
}

void test_400_validation_error_is_failure() {
  ReadingSubmitOutcome outcome =
      classifySubmitResponse(400, R"({"error":{"message":"Invalid sensor reading payload"}})");
  TEST_ASSERT_FALSE(outcome.success);
  TEST_ASSERT_FALSE(outcome.isDuplicate);
}

void test_401_unauthorized_is_failure() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(
      401, R"({"error":{"message":"Missing X-Device-Id or X-Device-Key header"}})");
  TEST_ASSERT_FALSE(outcome.success);
}

void test_409_conflict_is_failure() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(
      409, R"({"error":{"message":"readingId is already used by a different device"}})");
  TEST_ASSERT_FALSE(outcome.success);
}

void test_network_failure_negative_code_is_failure() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(-1, "");
  TEST_ASSERT_FALSE(outcome.success);
  TEST_ASSERT_FALSE(outcome.isDuplicate);
}

void test_not_connected_zero_code_is_failure() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(0, nullptr);
  TEST_ASSERT_FALSE(outcome.success);
  TEST_ASSERT_FALSE(outcome.isDuplicate);
}

void test_malformed_body_on_success_status_does_not_crash() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(201, "not valid json");
  TEST_ASSERT_TRUE(outcome.success);   // status code alone is enough for success
  TEST_ASSERT_FALSE(outcome.isDuplicate);  // can't confirm duplicate without a parseable body
}

void test_empty_body_on_success_status_does_not_crash() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(201, "");
  TEST_ASSERT_TRUE(outcome.success);
  TEST_ASSERT_FALSE(outcome.isDuplicate);
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_201_created_is_success_not_duplicate);
  RUN_TEST(test_200_duplicate_is_success_and_duplicate);
  RUN_TEST(test_400_validation_error_is_failure);
  RUN_TEST(test_401_unauthorized_is_failure);
  RUN_TEST(test_409_conflict_is_failure);
  RUN_TEST(test_network_failure_negative_code_is_failure);
  RUN_TEST(test_not_connected_zero_code_is_failure);
  RUN_TEST(test_malformed_body_on_success_status_does_not_crash);
  RUN_TEST(test_empty_body_on_success_status_does_not_crash);
  return UNITY_END();
}
