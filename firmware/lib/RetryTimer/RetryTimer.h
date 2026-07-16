#pragma once

#include <cstdint>

// Pure timing logic, deliberately with no Arduino dependency, so it can be
// unit-tested on the host machine (see test/test_retry_timer/) instead of
// only ever being trusted because it "looks right." The caller supplies
// "now" and "last attempt" (normally from millis()).
//
// Uses uint32_t specifically, NOT unsigned long: millis() returns
// unsigned long, which is exactly 32 bits on the ESP32 target — but
// unsigned long is a *different width* on a 64-bit host machine (e.g. the
// "native" test environment this is unit-tested under). Using a
// fixed-width uint32_t keeps the overflow/wraparound behavior identical
// on both, so a test proving this handles millis()'s ~49-day rollover
// actually simulates the real 32-bit wraparound rather than a 64-bit one
// that would never realistically happen.
//
// The subtraction wrapping correctly across rollover relies on unsigned
// arithmetic wrapping modulo 2^32 — (nowMs - lastAttemptMs) still yields
// the correct elapsed time even when nowMs has numerically wrapped past
// lastAttemptMs.
inline bool shouldRetryNow(uint32_t nowMs, uint32_t lastAttemptMs, uint32_t retryDelayMs) {
  return (uint32_t)(nowMs - lastAttemptMs) >= retryDelayMs;
}
