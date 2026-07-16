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

  // Meaningful only when success is false. True if this failure is worth
  // retrying (a network-level failure or a transient 5xx server error) —
  // false for a client error (4xx) that will fail identically on retry
  // without a code or configuration change. See classifySubmitResponse()
  // for the exact rule this follows, and lib/ReadingRetrier/ for what
  // consumes it.
  bool isRetryable;
};

// Classifies an HTTP response into a ReadingSubmitOutcome. `responseBody`
// is the raw JSON response body (see backend/src/routes/readings.ts) —
// may be null, empty, or malformed (e.g. after a network-level failure
// with no real HTTP response), which this function tolerates rather than
// crashing: a success verdict is drawn from httpStatusCode alone, and a
// bad/missing body just means isDuplicate falls back to false.
//
// Retryability rule (see backend/src/http/errors.ts for the status codes
// this project's backend actually emits: 400/401/403/404/409, plus a
// generic 500 for anything unhandled):
//   - httpStatusCode <= 0 (network-level failure: DNS, connection
//     refused, timeout, or the request was never attempted because Wi-Fi
//     wasn't connected — see ReadingSubmitter) is always retryable:
//     nothing about the request itself was rejected.
//   - httpStatusCode >= 500 (server error — backend/database trouble, not
//     a problem with this specific request) is retryable: presumed
//     transient.
//   - httpStatusCode == 429 (the standard "too many requests" code) is
//     retryable, even though this backend doesn't currently emit it —
//     retrying later is the textbook-correct response if it ever does.
//   - Every other 4xx (400 validation, 401/403 auth, 404, 409 conflict)
//     is NOT retryable: the backend rejected this specific request, and
//     an identical retry will fail identically every time.
ReadingSubmitOutcome classifySubmitResponse(int httpStatusCode, const char* responseBody);
