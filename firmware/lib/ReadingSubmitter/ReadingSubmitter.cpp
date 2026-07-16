#include "ReadingSubmitter.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <cstring>

namespace {
constexpr uint16_t HTTP_TIMEOUT_MS = 15000;
}

ReadingSubmitter::ReadingSubmitter(const char* apiUrl, const char* deviceIdentifier,
                                    const char* deviceKey)
    : apiUrl_(apiUrl), deviceIdentifier_(deviceIdentifier), deviceKey_(deviceKey) {}

ReadingSubmitter::Result ReadingSubmitter::submit(const char* jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ReadingSubmitter] submit skipped: Wi-Fi not connected");
    return Result{ReadingSubmitOutcome{false, false}, 0};
  }

  HTTPClient http;
  http.begin(apiUrl_);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", deviceIdentifier_);
  http.addHeader("X-Device-Key", deviceKey_);  // never logged — see below
  http.setTimeout(HTTP_TIMEOUT_MS);

  Serial.printf("[ReadingSubmitter] POST %s\n", apiUrl_);
  // HTTPClient::POST() takes a non-const uint8_t* on this core version
  // even though it never writes through it -- const_cast is safe here
  // (jsonPayload is genuinely not modified), just working around that
  // signature.
  int httpStatusCode =
      http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>(jsonPayload)), strlen(jsonPayload));

  String responseBody;
  if (httpStatusCode > 0) {
    responseBody = http.getString();
    Serial.printf("[ReadingSubmitter] HTTP %d\n", httpStatusCode);
    Serial.printf("[ReadingSubmitter] Response body: %s\n", responseBody.c_str());
  } else {
    Serial.printf("[ReadingSubmitter] Request failed: %s (code %d)\n",
                  http.errorToString(httpStatusCode).c_str(), httpStatusCode);
  }

  http.end();

  ReadingSubmitOutcome outcome = classifySubmitResponse(httpStatusCode, responseBody.c_str());
  if (outcome.success) {
    Serial.println(outcome.isDuplicate
                        ? "[ReadingSubmitter] Submission succeeded (duplicate, idempotent retry)"
                        : "[ReadingSubmitter] Submission succeeded (created)");
  } else {
    Serial.println("[ReadingSubmitter] Submission failed");
  }

  return Result{outcome, httpStatusCode};
}
