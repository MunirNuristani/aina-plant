#include "ProvisioningPortal.h"

#include <cstdio>
#include <cstring>
#include "WifiService.h"  // reuses maskSsid() -- same "never log credentials" discipline

namespace {
constexpr uint16_t DNS_PORT = 53;

// Minimal escaping for the query-arg values this device echoes back into
// its own HTML (deviceId/deviceKey are server-generated hex/UUIDs and
// never need this in practice, but `identifier` is a human-chosen string
// -- escape defensively rather than assume it's always simple).
String htmlEscape(const String& value) {
  String out;
  out.reserve(value.length());
  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];
    switch (c) {
      case '&': out += "&amp;"; break;
      case '<': out += "&lt;"; break;
      case '>': out += "&gt;"; break;
      case '"': out += "&quot;"; break;
      case '\'': out += "&#39;"; break;
      default: out += c;
    }
  }
  return out;
}
}  // namespace

ProvisioningPortal::ProvisioningPortal(const char* apSsid, const char* boardIdentifier,
                                       DeviceConfigStore& configStore)
    : apSsid_(apSsid), boardIdentifier_(boardIdentifier), configStore_(configStore), webServer_(80) {}

void ProvisioningPortal::begin() {
  // Station mode may already be active (the already-provisioned-but-
  // failing-to-connect path) -- AP_STA would let both run at once, but
  // there's no use for a station connection this device can't establish
  // anyway, so a clean switch to AP-only keeps behavior identical
  // whether this is a brand-new unit or a live fallback.
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid_);  // open network -- see firmware/README.md's documented trade-off

  IPAddress apIP = WiFi.softAPIP();
  Serial.print("[ProvisioningPortal] AP started: ");
  Serial.print(apSsid_);
  Serial.print(", IP ");
  Serial.println(apIP);

  dnsServer_.start(DNS_PORT, "*", apIP);

  webServer_.on("/", HTTP_GET, [this]() { handleRoot(); });
  webServer_.on("/setup", HTTP_GET, [this]() { handleRoot(); });
  webServer_.on("/setup", HTTP_POST, [this]() { handleSetup(); });
  webServer_.onNotFound([this]() {
    // Redirects any other request (including the various OS captive-
    // portal probe URLs) back to the setup form -- a convenience for
    // OSes that auto-detect and pop open a captive-portal browser. The
    // frontend's explicit link/QR remains the primary, always-working
    // path (see firmware/README.md) -- this is not depended on.
    webServer_.sendHeader("Location", "/setup", true);
    webServer_.send(302, "text/plain", "");
  });

  webServer_.begin();
}

void ProvisioningPortal::update() {
  dnsServer_.processNextRequest();
  webServer_.handleClient();
}

namespace {
void channelFieldNames(uint8_t channel, char* idField, size_t idFieldSize, char* keyField,
                       size_t keyFieldSize) {
  snprintf(idField, idFieldSize, "deviceId%u", channel + 1);
  snprintf(keyField, keyFieldSize, "deviceKey%u", channel + 1);
}
}  // namespace

void ProvisioningPortal::handleRoot() {
  String boardIdentifier = htmlEscape(webServer_.arg("boardIdentifier"));

  String html;
  html.reserve(1536);
  html += "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<title>AINA Device Setup</title></head><body style=\"font-family:sans-serif;max-width:400px;margin:2em auto;padding:0 1em\">";
  html += "<h1>Connect this device to Wi-Fi</h1>";
  html += "<form method=\"POST\" action=\"/setup\">";
  html += "<input type=\"hidden\" name=\"boardIdentifier\" value=\"" + boardIdentifier + "\">";

  // Echoes back only whichever of the 4 channel slots were actually in
  // the incoming URL -- initial board registration carries all 4, a
  // single-channel credential rotation carries just one (see
  // frontend/src/lib/device-setup-url.ts); an absent slot is simply
  // echoed back as an empty hidden field, which DeviceConfigStore::save()
  // treats as "leave this channel untouched" (see handleSetup()).
  for (uint8_t i = 0; i < DeviceConfigStore::CHANNEL_COUNT; i++) {
    char idField[16];
    char keyField[16];
    channelFieldNames(i, idField, sizeof(idField), keyField, sizeof(keyField));

    String deviceId = htmlEscape(webServer_.arg(idField));
    String deviceKey = htmlEscape(webServer_.arg(keyField));

    html += "<input type=\"hidden\" name=\"" + String(idField) + "\" value=\"" + deviceId + "\">";
    html += "<input type=\"hidden\" name=\"" + String(keyField) + "\" value=\"" + deviceKey + "\">";
  }

  html += "<label>Wi-Fi network name<br><input type=\"text\" name=\"ssid\" style=\"width:100%;padding:.5em;margin:.5em 0\"></label><br>";
  html += "<label>Wi-Fi password<br><input type=\"password\" name=\"password\" style=\"width:100%;padding:.5em;margin:.5em 0\"></label><br>";
  html += "<button type=\"submit\" style=\"padding:.7em 1.5em;margin-top:1em\">Save &amp; connect</button>";
  html += "</form></body></html>";

  webServer_.send(200, "text/html", html);
}

void ProvisioningPortal::handleSetup() {
  String ssid = webServer_.arg("ssid");
  String password = webServer_.arg("password");
  String submittedBoardIdentifier = webServer_.arg("boardIdentifier");

  Serial.printf("[ProvisioningPortal] setup submitted: ssid=\"%s\" (password redacted)\n",
                maskSsid(ssid.c_str()).c_str());

  // Rejects being on the wrong physical unit's AP mid-setup (e.g. a
  // second board's link tapped while still joined to this one's
  // network) -- nothing is written to Preferences and the device does
  // not restart. Board-level check: all 4 channels on one physical unit
  // share the same boardIdentifier_.
  if (submittedBoardIdentifier != boardIdentifier_) {
    Serial.println("[ProvisioningPortal] setup rejected: board identifier does not match this device");
    webServer_.send(409, "text/plain",
                     "This setup link is for a different device. Make sure you're joined to the "
                     "right device's Wi-Fi network and using its own link/QR code.");
    return;
  }

  // ssid is only required on a true first-time submission. A
  // single-channel credential rotation (device-detail-controls.tsx's
  // "Reconfigure Wi-Fi") omits ssid/password entirely and relies on
  // DeviceConfigStore::save()'s merge behavior to leave the already-
  // stored Wi-Fi credentials untouched -- so it's only an error if
  // there's no prior config to fall back on.
  DeviceConfigStore::Config existing{};
  bool hasExistingConfig = configStore_.load(existing);

  if (ssid.length() == 0 && !hasExistingConfig) {
    webServer_.send(400, "text/plain", "Missing required field(s) -- go back and try again.");
    return;
  }

  DeviceConfigStore::Config config{};
  ssid.toCharArray(config.wifiSsid, sizeof(config.wifiSsid));
  password.toCharArray(config.wifiPassword, sizeof(config.wifiPassword));

  for (uint8_t i = 0; i < DeviceConfigStore::CHANNEL_COUNT; i++) {
    char idField[16];
    char keyField[16];
    channelFieldNames(i, idField, sizeof(idField), keyField, sizeof(keyField));

    webServer_.arg(idField).toCharArray(config.deviceId[i], sizeof(config.deviceId[i]));
    webServer_.arg(keyField).toCharArray(config.deviceKey[i], sizeof(config.deviceKey[i]));
  }

  configStore_.save(config);

  webServer_.send(200, "text/html",
                   "<!DOCTYPE html><html><body style=\"font-family:sans-serif;max-width:400px;"
                   "margin:2em auto;padding:0 1em\"><h1>Saved</h1><p>Restarting and connecting to "
                   "your Wi-Fi network now.</p></body></html>");

  Serial.println("[ProvisioningPortal] config saved, restarting");
  delay(1000);  // lets the response actually reach the phone before the AP disappears
  ESP.restart();
}
