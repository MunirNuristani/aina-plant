#pragma once

#include <Arduino.h>
#include <cstdint>

#include "FirmwareReading.h"
#include "ReadingSubmitter.h"

// Adds retry policy on top of a single ReadingSubmitter::submit() call —
// mirrors how WifiService layers retry policy on top of WiFi.begin()/
// status(), reusing the same lib/RetryTimer/ timing logic for the
// controlled delay between attempts.
//
// Tracks exactly ONE in-flight reading at a time, not a queue: this
// firmware doesn't buffer multiple pending readings (see
// firmware/README.md's "Retry limitations" section for why, and what
// that trades away). beginSubmission() copies the caller's JSON into an
// internal buffer specifically so it survives across multiple loop()
// iterations after the caller's own (stack-allocated, per-iteration)
// buffer goes out of scope.
class ReadingRetrier {
public:
  // submitter: does the actual HTTP call — owned by the caller (main.cpp),
  //   referenced here, same lifetime assumption as WifiService's
  //   caller-owned ssid/password pointers.
  // retryDelayMs: minimum time between attempts once a submission needs
  //   retrying — a fixed controlled delay, not exponential backoff (see
  //   firmware/README.md for why that's the deliberate choice here, same
  //   reasoning WifiService already applies to its own reconnect delay).
  // maxAttempts: total submission attempts for one reading, including the
  //   first (immediate) one — e.g. 5 means at most 1 initial attempt plus
  //   4 retries before giving up. Bounds how long this firmware will keep
  //   retrying a single reading during a long-lived outage; see
  //   firmware/README.md's "Retry limitations" for what happens once this
  //   is exhausted.
  explicit ReadingRetrier(ReadingSubmitter& submitter, uint32_t retryDelayMs = 10000,
                           uint8_t maxAttempts = 5);

  // Starts tracking a new reading: copies `jsonPayload` into this
  // object's own buffer and makes the first submission attempt
  // immediately (blocking for that one attempt, same as calling
  // submitter.submit() directly — see ReadingSubmitter for why that's
  // bounded, not indefinite). If that attempt fails with a retryable
  // outcome, the reading is held pending for update() to retry later;
  // otherwise (success, or a non-retryable failure) nothing further
  // happens for this reading.
  //
  // Must not be called while isPending() is true — the caller
  // (main.cpp) is expected to check isPending() first and skip capturing
  // a new reading until the previous one resolves, which is what keeps
  // this class to tracking exactly one reading at a time.
  void beginSubmission(const char* jsonPayload);

  // Drives the retry timer: call every loop() iteration. A no-op unless
  // isPending() is true AND the controlled delay has elapsed (checked via
  // RetryTimer's shouldRetryNow(), never a blocking wait) — so this is
  // always safe and cheap to call regardless of pending state. When it
  // does act, it makes one more (blocking, bounded) submission attempt,
  // same as beginSubmission()'s first attempt.
  void update();

  // True while a reading is still being retried (has failed at least
  // once with a retryable outcome, and hasn't yet succeeded, failed
  // non-retryably, or exhausted maxAttempts). The caller uses this to
  // decide whether to pause capturing new readings.
  bool isPending() const { return hasPending_; }

private:
  ReadingSubmitter& submitter_;
  uint32_t retryDelayMs_;
  uint8_t maxAttempts_;

  char pendingJson_[FIRMWARE_READING_JSON_BUFFER_SIZE];
  bool hasPending_;
  uint8_t attemptCount_;
  uint32_t lastAttemptMs_;

  // Makes one submission attempt against pendingJson_, logs and
  // interprets the result, and updates hasPending_ accordingly. Shared by
  // beginSubmission() (attempt 1) and update() (attempt 2+).
  void attemptSubmission();
};
