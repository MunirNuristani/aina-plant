#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <cstdint>

// Manages the ESP32's Wi-Fi station connection: connects using configured
// credentials, detects disconnection, and retries with a controlled delay
// -- all without ever blocking the caller. This is the "reliability" piece
// for keeping the device connected without freezing the main program (the
// old aina_core.ino's connectWifi() blocked in a `while (...) { delay(500);
// }` loop; this module deliberately never does that).
//
// update() must be called on every loop() iteration to drive the
// connection state -- it always returns immediately (reads WiFi.status()
// and millis(), never delay()s or spins waiting for a connection).
//
// Credentials are supplied by the caller (constructor), not hardcoded in
// this module -- mirrors SoilMoistureSensor's pin-injection pattern, and
// keeps this module free of any specific network's secrets. The password
// is never logged; the SSID is masked before logging (see maskSsid()) so
// Serial output never reveals the full configured credentials.
class WifiService {
public:
  // ssid/password: the network to connect to. Stored as pointers to the
  //   caller-owned strings -- the caller (main.cpp) is expected to keep
  //   these alive for the lifetime of the WifiService instance (e.g. as
  //   file-scope constants), the same lifetime assumption used elsewhere
  //   in this codebase for const char* configuration.
  // retryDelayMs: minimum time between connection attempts once not
  //   connected (whether that's the first attempt taking a while, or a
  //   reconnect after a drop) -- prevents hammering WiFi.begin() in a
  //   tight loop while still retrying promptly.
  explicit WifiService(const char* ssid, const char* password, uint32_t retryDelayMs = 5000);

  // Puts the radio into station mode and starts the first connection
  // attempt. Call once from setup(). Non-blocking -- returns immediately;
  // the connection itself happens asynchronously and is observed via
  // update().
  void begin();

  // Drives the connection state: notices connect/disconnect transitions
  // and logs them, and retries (no more often than retryDelayMs_) while
  // not connected. Call every loop() iteration. Never blocks.
  void update();

  // True only when the radio currently reports an active connection
  // (WL_CONNECTED) -- always reflects live status, not cached state.
  bool isConnected() const;

private:
  const char* ssid_;
  const char* password_;
  uint32_t retryDelayMs_;

  // Tracks whether the last update() saw a connection, purely to detect
  // the connect/disconnect transition edges worth logging -- not used for
  // isConnected(), which always re-checks WiFi.status() directly.
  bool wasConnected_;
  uint32_t lastAttemptMs_;

  void attemptConnect();
};

// Redacts an SSID for logging: keeps the first and last character visible
// (enough to recognize which network in a Serial log) without printing it
// in full. Declared free-standing (not a WifiService member) since it has
// no dependency on connection state -- just string masking.
String maskSsid(const char* ssid);
