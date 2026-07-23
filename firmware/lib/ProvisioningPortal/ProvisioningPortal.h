#pragma once

#include <Arduino.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WiFi.h>
#include "DeviceConfigStore.h"

// Runs the device's SoftAP + captive-portal-style setup mode: an open
// Wi-Fi network the phone joins directly (works from any phone/OS/browser
// -- no Web Bluetooth, no companion app -- chosen specifically because
// Web Bluetooth doesn't exist on iOS, see firmware/README.md's
// "Device provisioning" section), plus a small self-served web form at
// http://192.168.4.1/setup that writes whatever's submitted into
// DeviceConfigStore and reboots into normal station-mode operation.
//
// The frontend hands the user a tappable link (or QR code) of the form
// http://192.168.4.1/setup?boardIdentifier=...&deviceId1=...&deviceKey1=...
// &deviceId2=...&deviceKey2=...&deviceId3=...&deviceKey3=...&deviceId4=...
// &deviceKey4=... (built by frontend/src/lib/device-setup-url.ts, with
// anywhere from 1 to 4 channel slots depending on whether this is initial
// board registration or a single channel's credential rotation) -- this
// class's GET handler reads those query args directly (WebServer parses
// them like any other request args) and echoes them back into the form's
// hidden fields, so the user only has to fill in their Wi-Fi network's
// SSID/password. This deliberately avoids any client-side JavaScript
// parsing of the URL -- the server already has the values by the time it
// renders the page.
//
// Non-blocking like WifiService: begin() starts the AP once, update()
// (called every loop() iteration while provisioning mode is active) just
// drives the DNS/HTTP servers and returns immediately. Arduino-dependent
// (WiFi.h/WebServer.h/DNSServer.h) -- like WifiService and
// DeviceConfigStore, only verifiable on real hardware, not natively
// tested.
class ProvisioningPortal {
public:
  // apSsid: name of the temporary Wi-Fi network this device hosts while
  //   in setup mode (e.g. "AINA-Setup-esp32-quad-01") -- open network,
  //   no password (see firmware/README.md's documented trade-off).
  // boardIdentifier: this unit's compiled-in board identifier (main.cpp's
  //   BOARD_IDENTIFIER) -- POST /setup checks the submitted
  //   `boardIdentifier` field against this before saving anything, so
  //   submitting to the wrong physical unit's AP (e.g. mid-way through
  //   setting up a second board) is rejected rather than silently
  //   misconfiguring a device. This is a board-level check, not
  //   per-channel -- all 4 channels on one physical unit share the same
  //   board identifier.
  // configStore: where a successful submission is persisted -- caller
  //   (main.cpp) owns its lifetime, mirroring how main.cpp already owns
  //   WifiService/ReadingSubmitter's lifetimes.
  explicit ProvisioningPortal(const char* apSsid, const char* boardIdentifier,
                               DeviceConfigStore& configStore);

  // Starts the AP, DNS redirect-all, and HTTP routes. Call once when
  // entering provisioning mode (main.cpp's enterProvisioningMode()) --
  // safe to call from setup() (brand-new unit) or mid-loop() (an
  // already-provisioned unit falling back after repeated connection
  // failures), since WiFi.mode(WIFI_AP) doesn't require a reboot.
  void begin();

  // Drives the DNS and HTTP servers. Call every loop() iteration while
  // provisioning mode is active. Never blocks except inside the POST
  // /setup handler's own brief, deliberate delay before ESP.restart() --
  // see ProvisioningPortal.cpp.
  void update();

private:
  const char* apSsid_;
  const char* boardIdentifier_;
  DeviceConfigStore& configStore_;
  DNSServer dnsServer_;
  WebServer webServer_;

  void handleRoot();
  void handleSetup();
};
