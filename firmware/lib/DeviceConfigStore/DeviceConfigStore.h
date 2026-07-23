#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <cstddef>
#include "UuidV4.h"

// Persists the fields that let this 4-sensor board operate without ever
// being reflashed to change them: which Wi-Fi network to join (one
// shared radio for the whole board), and each of the 4 channels'
// server-assigned credentials (Device.id / device credential) needed to
// authenticate that channel's readings. Backed by Preferences (the
// arduino-esp32 core's wrapper around ESP-IDF's NVS flash storage) --
// these values survive power loss and reboots, unlike the constexpr
// placeholders main.cpp used to hold a single sensor's credentials as
// before this board supported multiple channels.
//
// Deliberately does NOT store the board's `identifier` (the human-chosen
// string each channel's X-Device-Id header is derived from, e.g.
// "esp32-quad-01" -> "esp32-quad-01-ch1") -- that stays a flash-time
// constexpr in main.cpp (BOARD_IDENTIFIER). It's fixed per physical unit
// (printed as a QR label at manufacture time) and must match each
// channel's Device.identifier in the backend forever; there's no
// scenario where it changes at runtime, so it never belongs here.
//
// Arduino-dependent (Preferences wraps flash access) -- like WifiService
// and ReadingSubmitter, this can only be verified on real hardware, not
// unit-tested on the `native` PlatformIO environment (see
// firmware/README.md's "why no native tests" note for the same reasoning
// applied here).
class DeviceConfigStore {
public:
  // Fixed at 4 -- this board is exactly 4 soil-moisture channels, not a
  // configurable count (see firmware/README.md's "Device provisioning"
  // section for why this stays a hardcoded constant rather than a
  // generic N-sensor abstraction).
  static constexpr uint8_t CHANNEL_COUNT = 4;

  // Sized with margin over what's actually needed, the same "conservative
  // upper bound" convention FirmwareReading.h uses:
  //   wifiSsid: 802.11 SSIDs are at most 32 bytes.
  //   wifiPassword: WPA2 passphrases are at most 63 characters.
  //   deviceId: a UUID (see UuidV4.h).
  //   deviceKey: the backend's device credential is 64 hex characters
  //     (see backend/src/lib/device-credential.ts's randomBytes(32).toString('hex')),
  //     with margin to spare here in case that ever changes.
  struct Config {
    char wifiSsid[33];
    char wifiPassword[65];
    char deviceId[CHANNEL_COUNT][UUID_V4_STRING_LENGTH + 1];
    char deviceKey[CHANNEL_COUNT][80];
  };

  explicit DeviceConfigStore(const char* namespaceName = "ainacfg");

  // Reads wifiSsid/wifiPassword and all 4 channels' deviceId/deviceKey
  // into `out`. Returns false (and leaves `out` untouched) only if
  // wifiSsid or wifiPassword is missing -- e.g. a brand-new unit whose
  // flash has never been written, or one that was explicitly cleared --
  // which is exactly the signal main.cpp uses to decide whether to boot
  // straight into ProvisioningPortal's setup mode instead of attempting a
  // Wi-Fi connection with nothing configured. A channel's deviceId/
  // deviceKey being empty in a *successful* load() just means that
  // channel hasn't been set up (main.cpp's runChannelCycle() skips it
  // entirely) -- this is what lets a board run with anywhere from 1 to 4
  // channels configured, not only all 4 at once.
  bool load(Config& out);

  // Merges `config` into whatever's already stored: only fields that are
  // non-empty in `config` are written, everything else already in flash
  // is left untouched. This (not a full overwrite) is what lets
  // ProvisioningPortal's POST /setup submit just one channel's
  // deviceId/deviceKey (e.g. rotating a single channel's credential from
  // device-detail-controls.tsx's "Reconfigure Wi-Fi") without wiping the
  // Wi-Fi credentials or the other 3 channels' identities -- a true
  // first-time submission simply supplies all 10 fields, which has the
  // same effect a full overwrite would have.
  void save(const Config& config);

  // Erases every key in this namespace. Not currently called anywhere in
  // main.cpp's normal flow (re-provisioning merges via save(), it
  // doesn't need to clear first) -- exposed for manual recovery (e.g. via
  // a future serial command) and for test/debugging use.
  void clear();

private:
  const char* namespaceName_;
};
