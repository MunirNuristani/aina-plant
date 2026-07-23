#include "DeviceConfigStore.h"

namespace {
constexpr const char* KEY_WIFI_SSID = "wifiSsid";
constexpr const char* KEY_WIFI_PASSWORD = "wifiPassword";

// NVS keys are 1-indexed ("deviceId1".."deviceId4") to match the
// provisioning URL's query param names exactly (see ProvisioningPortal),
// even though `channel` (the in-memory array index) is 0-indexed.
void deviceIdKey(uint8_t channel, char* out, size_t outSize) {
  snprintf(out, outSize, "deviceId%u", channel + 1);
}

void deviceKeyKey(uint8_t channel, char* out, size_t outSize) {
  snprintf(out, outSize, "deviceKey%u", channel + 1);
}
}  // namespace

DeviceConfigStore::DeviceConfigStore(const char* namespaceName) : namespaceName_(namespaceName) {}

bool DeviceConfigStore::load(Config& out) {
  Preferences prefs;
  prefs.begin(namespaceName_, /* readOnly= */ true);

  // Only Wi-Fi credentials gate whether this board counts as
  // "configured" -- isKey() (not just a fallback-default getString())
  // distinguishes "never configured" from "configured with an empty
  // string," a brand-new unit's flash having neither key at all. A
  // channel's deviceId/deviceKey being absent just means that channel
  // hasn't been set up yet (see Channel/runChannelCycle() in main.cpp,
  // which skips any channel with an empty deviceId entirely) -- not that
  // the whole board needs to stay in provisioning mode. This is what
  // lets a board be provisioned with anywhere from 1 to 4 channels set
  // up, not just all 4 at once.
  bool complete = prefs.isKey(KEY_WIFI_SSID) && prefs.isKey(KEY_WIFI_PASSWORD);

  if (!complete) {
    prefs.end();
    return false;
  }

  prefs.getString(KEY_WIFI_SSID, "").toCharArray(out.wifiSsid, sizeof(out.wifiSsid));
  prefs.getString(KEY_WIFI_PASSWORD, "").toCharArray(out.wifiPassword, sizeof(out.wifiPassword));

  // getString()'s "" default (not gated on isKey()) means an
  // unconfigured channel's deviceId/deviceKey come back as empty strings
  // here, exactly the signal runChannelCycle() uses to skip it.
  char key[16];
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    deviceIdKey(i, key, sizeof(key));
    prefs.getString(key, "").toCharArray(out.deviceId[i], sizeof(out.deviceId[i]));
    deviceKeyKey(i, key, sizeof(key));
    prefs.getString(key, "").toCharArray(out.deviceKey[i], sizeof(out.deviceKey[i]));
  }

  prefs.end();
  return true;
}

void DeviceConfigStore::save(const Config& config) {
  Preferences prefs;
  prefs.begin(namespaceName_, /* readOnly= */ false);

  // Merge, not overwrite: only fields actually supplied (non-empty) are
  // written -- see DeviceConfigStore.h's save() comment for why. A truly
  // first-time submission supplies everything, so this has the same net
  // effect a full overwrite would have.
  if (config.wifiSsid[0] != '\0') {
    prefs.putString(KEY_WIFI_SSID, config.wifiSsid);
  }
  if (config.wifiPassword[0] != '\0') {
    prefs.putString(KEY_WIFI_PASSWORD, config.wifiPassword);
  }

  char key[16];
  for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
    if (config.deviceId[i][0] != '\0') {
      deviceIdKey(i, key, sizeof(key));
      prefs.putString(key, config.deviceId[i]);
    }
    if (config.deviceKey[i][0] != '\0') {
      deviceKeyKey(i, key, sizeof(key));
      prefs.putString(key, config.deviceKey[i]);
    }
  }

  prefs.end();
}

void DeviceConfigStore::clear() {
  Preferences prefs;
  prefs.begin(namespaceName_, /* readOnly= */ false);
  prefs.clear();
  prefs.end();
}
