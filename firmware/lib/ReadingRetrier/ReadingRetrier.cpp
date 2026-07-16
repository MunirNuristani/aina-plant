#include "ReadingRetrier.h"

#include <cstring>

#include "RetryTimer.h"

ReadingRetrier::ReadingRetrier(ReadingSubmitter& submitter, uint32_t retryDelayMs,
                                uint8_t maxAttempts)
    : submitter_(submitter),
      retryDelayMs_(retryDelayMs),
      maxAttempts_(maxAttempts),
      hasPending_(false),
      attemptCount_(0),
      lastAttemptMs_(0) {}

void ReadingRetrier::beginSubmission(const char* jsonPayload) {
  strncpy(pendingJson_, jsonPayload, sizeof(pendingJson_) - 1);
  pendingJson_[sizeof(pendingJson_) - 1] = '\0';
  attemptCount_ = 1;
  attemptSubmission();
}

void ReadingRetrier::update() {
  if (!hasPending_) return;
  if (!shouldRetryNow(millis(), lastAttemptMs_, retryDelayMs_)) return;

  if (attemptCount_ >= maxAttempts_) {
    Serial.printf(
        "[ReadingRetrier] Giving up after %u attempts -- this reading is dropped, normal "
        "capture resumes next cycle\n",
        attemptCount_);
    hasPending_ = false;
    return;
  }

  attemptCount_++;
  attemptSubmission();
}

void ReadingRetrier::attemptSubmission() {
  lastAttemptMs_ = millis();
  ReadingSubmitter::Result result = submitter_.submit(pendingJson_);

  if (result.outcome.success) {
    Serial.printf("[ReadingRetrier] Submission succeeded on attempt %u/%u\n", attemptCount_,
                  maxAttempts_);
    hasPending_ = false;
    return;
  }

  if (!result.outcome.isRetryable) {
    Serial.printf(
        "[ReadingRetrier] Submission failed with non-retryable status %d on attempt %u -- "
        "giving up immediately (no retry)\n",
        result.httpStatusCode, attemptCount_);
    hasPending_ = false;
    return;
  }

  Serial.printf(
      "[ReadingRetrier] Submission failed with retryable status %d (attempt %u/%u) -- will "
      "retry\n",
      result.httpStatusCode, attemptCount_, maxAttempts_);
  hasPending_ = true;
}
