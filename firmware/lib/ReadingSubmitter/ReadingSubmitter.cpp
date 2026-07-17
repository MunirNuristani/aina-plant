#include "ReadingSubmitter.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <cstring>

namespace {
constexpr uint16_t HTTP_TIMEOUT_MS = 15000;
constexpr const char* HTTPS_PREFIX = "https://";
}

ReadingSubmitter::ReadingSubmitter(const char* apiUrl, const char* deviceIdentifier,
                                    const char* deviceKey)
    : apiUrl_(apiUrl), deviceIdentifier_(deviceIdentifier), deviceKey_(deviceKey) {}

ReadingSubmitter::Result ReadingSubmitter::submit(const char* jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ReadingSubmitter] submit skipped: Wi-Fi not connected");
    return Result{ReadingSubmitOutcome{false, false}, 0};
  }

  // The client object must outlive http.begin()/POST()/end() below, so
  // both live here regardless of which one actually gets used --
  // WiFiClientSecure always negotiates TLS, so it can't be reused for a
  // plain http:// apiUrl_ (and vice versa), hence the scheme check rather
  // than always using one or the other.
  bool useHttps = strncmp(apiUrl_, HTTPS_PREFIX, strlen(HTTPS_PREFIX)) == 0;
  WiFiClientSecure secureClient;
  WiFiClient plainClient;

  HTTPClient http;
  if (useHttps) {
    // No certificate validation -- see ReadingSubmitter.h's class comment
    // for why that's an accepted trade-off here.
    secureClient.setInsecure();
    http.begin(secureClient, apiUrl_);
  } else {
    http.begin(plainClient, apiUrl_);
  }
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
