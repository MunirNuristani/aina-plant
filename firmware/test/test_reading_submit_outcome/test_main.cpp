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

void test_network_failure_is_retryable() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(-1, "");
  TEST_ASSERT_TRUE(outcome.isRetryable);
}

void test_not_connected_zero_code_is_retryable() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(0, nullptr);
  TEST_ASSERT_TRUE(outcome.isRetryable);
}

void test_500_internal_error_is_retryable() {
  ReadingSubmitOutcome outcome =
      classifySubmitResponse(500, R"({"error":{"message":"Internal server error"}})");
  TEST_ASSERT_FALSE(outcome.success);
  TEST_ASSERT_TRUE(outcome.isRetryable);
}

void test_502_503_504_are_retryable() {
  TEST_ASSERT_TRUE(classifySubmitResponse(502, "").isRetryable);
  TEST_ASSERT_TRUE(classifySubmitResponse(503, "").isRetryable);
  TEST_ASSERT_TRUE(classifySubmitResponse(504, "").isRetryable);
}

void test_429_too_many_requests_is_retryable() {
  ReadingSubmitOutcome outcome = classifySubmitResponse(429, "");
  TEST_ASSERT_FALSE(outcome.success);
  TEST_ASSERT_TRUE(outcome.isRetryable);
}

void test_400_validation_error_is_not_retryable() {
  ReadingSubmitOutcome outcome =
      classifySubmitResponse(400, R"({"error":{"message":"Invalid sensor reading payload"}})");
  TEST_ASSERT_FALSE(outcome.isRetryable);
}

void test_401_unauthorized_is_not_retryable() {
  TEST_ASSERT_FALSE(classifySubmitResponse(401, "").isRetryable);
}

void test_403_forbidden_is_not_retryable() {
  TEST_ASSERT_FALSE(classifySubmitResponse(403, "").isRetryable);
}

void test_404_not_found_is_not_retryable() {
  TEST_ASSERT_FALSE(classifySubmitResponse(404, "").isRetryable);
}

void test_409_conflict_is_not_retryable() {
  TEST_ASSERT_FALSE(classifySubmitResponse(409, "").isRetryable);
}

void test_success_responses_are_not_flagged_retryable() {
  // isRetryable is meaningful only when success is false -- both success
  // paths should leave it at its default (false), never true.
  TEST_ASSERT_FALSE(classifySubmitResponse(201, R"({"status":"created"})").isRetryable);
  TEST_ASSERT_FALSE(classifySubmitResponse(200, R"({"status":"duplicate"})").isRetryable);
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
  RUN_TEST(test_network_failure_is_retryable);
  RUN_TEST(test_not_connected_zero_code_is_retryable);
  RUN_TEST(test_500_internal_error_is_retryable);
  RUN_TEST(test_502_503_504_are_retryable);
  RUN_TEST(test_429_too_many_requests_is_retryable);
  RUN_TEST(test_400_validation_error_is_not_retryable);
  RUN_TEST(test_401_unauthorized_is_not_retryable);
  RUN_TEST(test_403_forbidden_is_not_retryable);
  RUN_TEST(test_404_not_found_is_not_retryable);
  RUN_TEST(test_409_conflict_is_not_retryable);
  RUN_TEST(test_success_responses_are_not_flagged_retryable);
  return UNITY_END();
}
