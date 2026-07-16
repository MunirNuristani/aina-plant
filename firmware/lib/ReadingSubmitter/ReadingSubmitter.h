#pragma once

#include <Arduino.h>

#include "ReadingSubmitOutcome.h"

// Sends an already-serialized reading (see FirmwareReading.h /
// serializeFirmwareReading()) to the backend's POST /api/v1/readings over
// HTTP, with the X-Device-Id / X-Device-Key headers the backend's
// deviceAuthMiddleware requires (see
// backend/src/middleware/device-auth.ts).
//
// Deliberately plain HTTP, not HTTPS: this targets the backend running on
// the local network during development (see firmware/README.md's "Local
// network address setup" section), not a deployed production API — a
// production deployment would need an https:// apiUrl plus the
// corresponding WiFiClientSecure/certificate setup, which is out of scope
// here.
class ReadingSubmitter {
public:
  // apiUrl: full URL of the readings endpoint, e.g.
  //   "http://192.168.1.42:3000/api/v1/readings" — see
  //   firmware/README.md for how to find your machine's LAN address.
  // deviceIdentifier/deviceKey: this device's auth credentials — the
  //   *identifier* (goes in the X-Device-Id header), not its
  //   server-assigned deviceId (which goes in the JSON body instead —
  //   see FirmwareReading.h's deviceId field comment for why they
  //   differ).
  explicit ReadingSubmitter(const char* apiUrl, const char* deviceIdentifier,
                             const char* deviceKey);

  struct Result {
    ReadingSubmitOutcome outcome;

    // Raw HTTP status code. 0 if the request was never attempted (Wi-Fi
    // not connected); negative for a network-level failure (DNS,
    // connection refused, timeout, ...) — see HTTPClient::errorToString()
    // for what these mean, logged inside submit() itself.
    int httpStatusCode;
  };

  // POSTs `jsonPayload` (a null-terminated JSON string). Blocking —
  // HTTPClient::POST() has no async variant on this platform — but
  // bounded by an internal request timeout, so this never blocks
  // indefinitely. Returns immediately with a "not connected" failure
  // result (httpStatusCode 0) if Wi-Fi isn't currently connected, rather
  // than attempting (and slowly timing out on) a doomed request.
  //
  // Logs the HTTP status code and response body — both safe to log (see
  // backend/src/routes/readings.ts's response shapes: never anything
  // credential-bearing) — but never deviceKey_, mirroring WifiService's
  // "never log credentials" principle for the Wi-Fi password.
  Result submit(const char* jsonPayload);

private:
  const char* apiUrl_;
  const char* deviceIdentifier_;
  const char* deviceKey_;
};
