#pragma once

// Interpreting the backend's HTTP response to a reading submission is
// pure classification logic with no Arduino/network dependency of its
// own, so it's unit-tested on the host machine
// (test/test_reading_submit_outcome/) independent of the actual HTTP call
// (see lib/ReadingSubmitter/, which is Arduino-dependent and can only be
// verified on real hardware).

struct ReadingSubmitOutcome {
  // True for HTTP 200 (duplicate, idempotent retry recognized) or 201
  // (newly created) — see backend/src/routes/readings.ts. Both mean the
  // backend now has this reading stored, which is what "success" means
  // here; every other status (4xx validation/auth/conflict errors, 5xx,
  // or a non-positive code representing a network-level failure) is not.
  bool success;

  // True only when success is true AND the backend's response body
  // reports status == "duplicate" — i.e. this reading was already stored
  // from an earlier submission attempt, not newly created just now.
  bool isDuplicate;
};

// Classifies an HTTP response into a ReadingSubmitOutcome. `responseBody`
// is the raw JSON response body (see backend/src/routes/readings.ts) —
// may be null, empty, or malformed (e.g. after a network-level failure
// with no real HTTP response), which this function tolerates rather than
// crashing: a success verdict is drawn from httpStatusCode alone, and a
// bad/missing body just means isDuplicate falls back to false.
ReadingSubmitOutcome classifySubmitResponse(int httpStatusCode, const char* responseBody);
