#include "ReadingSubmitOutcome.h"

#include <ArduinoJson.h>
#include <cstring>

ReadingSubmitOutcome classifySubmitResponse(int httpStatusCode, const char* responseBody) {
  ReadingSubmitOutcome outcome{false, false, false};

  if (httpStatusCode != 200 && httpStatusCode != 201) {
    outcome.isRetryable =
        (httpStatusCode <= 0) || (httpStatusCode >= 500) || (httpStatusCode == 429);
    return outcome;
  }
  outcome.success = true;

  if (responseBody == nullptr || responseBody[0] == '\0') {
    return outcome;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, responseBody);
  if (err) {
    return outcome;
  }

  const char* status = doc["status"] | "";
  outcome.isDuplicate = (strcmp(status, "duplicate") == 0);
  return outcome;
}
