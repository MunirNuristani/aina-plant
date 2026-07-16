#include "WifiService.h"
#include "RetryTimer.h"

WifiService::WifiService(const char* ssid, const char* password, uint32_t retryDelayMs)
    : ssid_(ssid),
      password_(password),
      retryDelayMs_(retryDelayMs),
      wasConnected_(false),
      lastAttemptMs_(0) {}

void WifiService::begin() {
  // Station mode explicitly, rather than relying on the core's default --
  // this device only ever joins an existing network, never hosts one.
  WiFi.mode(WIFI_STA);
  attemptConnect();
}

void WifiService::update() {
  bool connectedNow = isConnected();

  if (connectedNow && !wasConnected_) {
    Serial.print("[WifiService] connected, IP: ");
    Serial.println(WiFi.localIP());
    wasConnected_ = true;
    return;
  }

  if (!connectedNow && wasConnected_) {
    Serial.println("[WifiService] disconnected -- will retry");
    wasConnected_ = false;
    // Restart the retry clock from the moment the drop was noticed, not
    // from whenever the original connection attempt happened to start.
    lastAttemptMs_ = millis();
    return;
  }

  if (!connectedNow && shouldRetryNow(millis(), lastAttemptMs_, retryDelayMs_)) {
    attemptConnect();
  }
}

bool WifiService::isConnected() const {
  return WiFi.status() == WL_CONNECTED;
}

void WifiService::attemptConnect() {
  Serial.printf("[WifiService] connecting to \"%s\" (password redacted)\n",
                maskSsid(ssid_).c_str());
  WiFi.begin(ssid_, password_);
  lastAttemptMs_ = millis();
}

String maskSsid(const char* ssid) {
  if (ssid == nullptr) return String("<none>");

  size_t len = strlen(ssid);
  if (len == 0) return String("<empty>");
  if (len <= 2) return String("**");

  String masked;
  masked += ssid[0];
  for (size_t i = 1; i + 1 < len; i++) {
    masked += '*';
  }
  masked += ssid[len - 1];
  return masked;
}
