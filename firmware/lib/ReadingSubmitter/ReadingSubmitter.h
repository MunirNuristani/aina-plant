#pragma once

#include <Arduino.h>

#include "ReadingSubmitOutcome.h"

// Sends an already-serialized reading (see FirmwareReading.h /
// serializeFirmwareReading()) to the backend's POST /api/v1/readings, with
// the X-Device-Id / X-Device-Key headers the backend's deviceAuthMiddleware
// requires (see backend/src/middleware/device-auth.ts).
//
// Supports both plain HTTP and HTTPS, chosen by apiUrl's scheme (see
// submit()) -- HTTP for a backend on the local network during development
// (see firmware/README.md's "Local network address setup" section), HTTPS
// for a deployed production API (see docs/DEPLOYMENT.md), which is what a
// real ESP32 out on Wi-Fi rather than your dev LAN needs, since that's the
// only thing a PaaS host like Render exposes publicly. The HTTPS path uses
// WiFiClientSecure::setInsecure() -- the connection is encrypted but the
// server's certificate isn't verified, so this doesn't protect against a
// MITM on the network path. Acceptable for this project (no data more
// sensitive than a revocable device credential and soil moisture
// readings); real certificate pinning via setCACert() is the upgrade path
// if that trade-off ever stops being acceptable.
class ReadingSubmitter {
public:
  // apiUrl: full URL of the readings endpoint, either
  //   "http://192.168.1.42:3000/api/v1/readings" (local -- see
  //   firmware/README.md for how to find your machine's LAN address) or
  //   "https://your-app.onrender.com/api/v1/readings" (deployed -- see
  //   docs/DEPLOYMENT.md).
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
