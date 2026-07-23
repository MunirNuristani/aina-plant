#include <Arduino.h>
#include <esp_random.h>
#include <time.h>
#include <cstdio>
#include <cstring>
#include "SoilMoistureSensor.h"
#include "MoistureCalibration.h"
#include "WifiService.h"
#include "FirmwareReading.h"
#include "ReadingSubmitter.h"
#include "ReadingRetrier.h"
#include "PlantDisplay.h"
#include "DeviceConfigStore.h"
#include "ProvisioningPortal.h"
#include "ProvisioningTrigger.h"

// This board has exactly 4 soil-moisture channels (see Channel/channels
// below) -- GPIO32/33/34/35 are all ADC1-capable, which (unlike ADC2)
// stays usable once Wi-Fi is active. Channel 1 keeps GPIO34, the pin the
// original single-sensor build already used.
constexpr uint8_t SOIL_SENSOR_PINS[DeviceConfigStore::CHANNEL_COUNT] = {34, 32, 33, 35};

// How many raw samples make up one filtered reading, and how far apart
// they're spaced. 10 samples was chosen as enough to make the median
// filter meaningfully resistant to a single noisy/outlier sample, without
// taking so long that one reading cycle noticeably delays the device's
// reporting interval. 15ms between samples lets the ADC and the sensor's
// own analog output settle between reads, rather than sampling faster
// than the signal can actually change. Both are tunable once real
// hardware is available to measure actual noise characteristics.
constexpr uint8_t SOIL_SENSOR_SAMPLE_COUNT = 10;
constexpr uint16_t SOIL_SENSOR_SAMPLE_DELAY_MS = 15;

// Centralized calibration reference points -- the single place these
// numbers live, shared by all 4 channels (each is the same kind of
// capacitive sensor). Change them here once real hardware is calibrated;
// no other file needs to change. (A future ticket will sync these from
// the backend's Calibration API instead of a compile-time constant, and
// may need to become per-channel if different sensor units ever drift
// apart.)
constexpr MoistureCalibration soilCalibration{/* dryValue= */ 3000, /* wetValue= */ 1200};

// Time between full reading cycles in the demo loop below. All 4
// channels are processed sequentially within one cycle (see
// runChannelCycle()/loop()) -- the real device's actual reporting
// interval is a separate, server-side-configured concept
// (Device.reportingIntervalSeconds in the backend) -- this is just a
// local main-loop demo pace, not a design decision that comes with any
// networking behavior yet.
constexpr unsigned long LOOP_DELAY_MS = 5000;

// Wi-Fi credentials and each channel's server-assigned id/key are NOT
// compile-time constants -- see storedWifiSsid/storedWifiPassword below
// (shared) and Channel::deviceId/deviceKey (per-channel). They're loaded
// at boot from DeviceConfigStore (backed by flash/NVS) and, on a
// brand-new unit or one that can no longer connect, (re)provisioned over
// ProvisioningPortal's SoftAP setup mode instead of ever being edited
// here and reflashed. See firmware/README.md's "Device provisioning"
// section.
constexpr const char* FIRMWARE_VERSION = "1.0.0";

// Where the backend's readings endpoint lives, shared by all 4 channels.
// ReadingSubmitter picks plain HTTP or HTTPS based on this URL's scheme
// (see ReadingSubmitter.h), so either of these work:
//   - Local: "http://YOUR_LAN_IP:3000/api/v1/readings" -- points at the
//     machine running the backend on your local network. NOT "localhost",
//     which from the ESP32's point of view means the ESP32 itself. See
//     firmware/README.md's "Local network address setup" section for how
//     to find your machine's LAN IP and why port 3000 (the backend's
//     default -- see backend/.env.example) must be reachable from the
//     ESP32.
//   - Deployed: "https://<your-app>.onrender.com/api/v1/readings" -- see
//     docs/DEPLOYMENT.md. Currently set to this project's own deployment.
constexpr const char* API_URL = "https://aina-plant.onrender.com/api/v1/readings";

// This board's identifier -- a human-chosen string, not a secret (same
// idea as a username), so it's safe to commit here. Fixed per physical
// unit at flash time: it's what gets printed as this unit's QR label,
// and what each channel's derived identifier ("<BOARD_IDENTIFIER>-chN",
// see Channel below) must match against the backend's Device.identifier
// (@unique) forever -- unlike Wi-Fi credentials and each channel's
// server-assigned id/key, there's no scenario where this needs to change
// at runtime, so it stays a compile-time constant rather than living in
// DeviceConfigStore. One base identifier with 4 derived suffixes (rather
// than 4 independent compile-time constants) keeps this the single
// source of truth -- no risk of 4 hand-written constants drifting apart.
//
// backend/prisma/seed.ts's fixture device (dev-seed-device-001) is a
// different, intentionally-public dev-only identifier for local testing
// against a freshly seeded local backend -- see "Testing against the
// seeded dev device" in firmware/README.md. It's channel-1-only: the
// seed fixture registers a single device, not a 4-channel board.
constexpr const char* BOARD_IDENTIFIER = "esp32-quad-01";

// How many consecutive failed Wi-Fi (re)connect attempts (see
// WifiService::consecutiveFailedAttempts()) before an already-provisioned
// board gives up on its configured network and falls back into
// ProvisioningPortal's setup mode -- roughly 10 * WifiService's default
// 5000ms retry delay = ~50s of sustained failure, not a single blip. This
// is board-level, not per-channel: there's only one shared Wi-Fi
// connection for all 4 channels. Tunable once real hardware shows what a
// reasonable outage tolerance looks like.
constexpr uint32_t WIFI_FAILURE_THRESHOLD_FOR_PROVISIONING = 10;

// Anything before this means the ESP32's clock hasn't received NTP time
// yet (it boots at epoch 0) — used to detect "not synced" rather than
// reporting a bogus 1970 timestamp. 2024-01-01T00:00:00Z; arbitrary other
// than being comfortably before any real deployment and comfortably after
// epoch 0.
constexpr time_t PLAUSIBLE_MIN_EPOCH = 1704067200;

// Timezone offset for the LCD's displayed date only -- never applied to
// FirmwareReading's recordedAt, which must stay true UTC (see
// FirmwareReading.h and the backend's z.iso.datetime() check). -25200 =
// UTC-7 (Pacific Daylight Time). This is a *fixed* manual offset, not
// automatic DST handling: Iso8601 deliberately does its own calendar math
// instead of depending on libc's timezone database (see Iso8601.h), so
// there's no TZ-string/DST-rule machinery to hook into here. Update this
// constant by hand when DST changes (e.g. -28800 for PST in winter), or
// change it entirely if the device is deployed somewhere else.
constexpr int32_t UTC_OFFSET_SECONDS = -7 * 3600;

// Wi-Fi credentials -- one shared radio for the whole board -- loaded
// from DeviceConfigStore at startup, never compiled in. Declared before
// wifiService below because its constructor only stores *pointers* to
// these buffers (see WifiService.h's "caller owns the lifetime"
// contract) -- the buffers' actual contents just need to be correct by
// the time begin() is actually called, which is after setup() has loaded
// them (see setup() below).
char storedWifiSsid[33] = "";
char storedWifiPassword[65] = "";

// Built once in setup(), before any possible call to
// enterProvisioningMode() -- see setup().
char provisioningApSsid[48] = "";

// One soil-moisture channel: its own sensor (a distinct GPIO pin), its
// own server-assigned identity (a derived identifier plus a
// provisioned deviceId/deviceKey), its own submitter/retrier (so one
// channel's in-flight retry never blocks the other three's fresh
// reads -- see runChannelCycle()), and its own last-known-moisture state
// for the LCD (see PlantDisplay.h's "never fabricate" note, applied per
// channel here the same way the single-sensor build applied it globally).
//
// Plain data + owned sub-objects, no logic of its own -- the actual
// per-cycle behavior lives in the free function runChannelCycle(),
// matching this codebase's existing style of keeping structs dumb (e.g.
// FirmwareReading) and logic in free functions/classes.
struct Channel {
  // "<BOARD_IDENTIFIER>-chN" -- derived in setup(), not compiled in (see
  // BOARD_IDENTIFIER's comment above).
  char identifier[48] = "";
  char deviceId[UUID_V4_STRING_LENGTH + 1] = "";
  char deviceKey[80] = "";

  SoilMoistureSensor sensor;
  ReadingSubmitter submitter;
  ReadingRetrier retrier;

  bool hasLastMoisture = false;
  uint8_t lastMoisturePercent = 0;

  // identifier/deviceKey are declared above sensor/submitter/retrier
  // specifically so submitter's constructor can store valid pointers to
  // them here -- their *contents* are filled in later by setup(), the
  // same "pointer valid now, contents correct later" pattern this file
  // already used for storedWifiSsid/storedWifiPassword. retrier's
  // ReadingSubmitter& binds to this same instance's submitter member,
  // safe because `channels` (below) is a fixed global array, never
  // copied or resized.
  explicit Channel(uint8_t pin, const char* apiUrl)
      : sensor(pin, SOIL_SENSOR_SAMPLE_COUNT, SOIL_SENSOR_SAMPLE_DELAY_MS),
        submitter(apiUrl, identifier, deviceKey),
        retrier(submitter) {}
};

Channel channels[DeviceConfigStore::CHANNEL_COUNT] = {
    Channel(SOIL_SENSOR_PINS[0], API_URL),
    Channel(SOIL_SENSOR_PINS[1], API_URL),
    Channel(SOIL_SENSOR_PINS[2], API_URL),
    Channel(SOIL_SENSOR_PINS[3], API_URL),
};

WifiService wifiService(storedWifiSsid, storedWifiPassword);
PlantDisplay plantDisplay;
DeviceConfigStore deviceConfigStore;
ProvisioningPortal provisioningPortal(provisioningApSsid, BOARD_IDENTIFIER, deviceConfigStore);
bool ntpSyncStarted = false;

// Set once, the moment a brand-new (never-configured) unit boots or an
// already-provisioned one gives up on its configured Wi-Fi -- see
// enterProvisioningMode() and loop() below. While true, loop() does
// nothing but drive ProvisioningPortal.
bool provisioningModeActive = false;

// Thin glue around the ESP32's hardware RNG (esp_random(), part of the
// ESP-IDF, not a library worth wrapping any further) plus UuidV4's pure
// formatter. Lives here rather than in a lib/ module because there's no
// logic in it worth unit-testing separately from formatUuidV4() itself,
// which already is (see test/test_uuid_v4/).
void generateReadingId(char out[UUID_V4_STRING_LENGTH + 1]) {
  uint8_t randomBytes[16];
  for (int i = 0; i < 4; i++) {
    uint32_t word = esp_random();
    memcpy(randomBytes + i * 4, &word, sizeof(word));
  }
  formatUuidV4(randomBytes, out);
}

// Switches into SoftAP setup mode -- used both when a brand-new unit has
// no stored config yet (setup(), below) and when an already-provisioned
// board's Wi-Fi has failed repeatedly (loop(), below). Both converge on
// this exact same function rather than getting separate handling, since
// from this point on they're identical: sit in provisioning mode until a
// successful /setup submission triggers ESP.restart() (see
// ProvisioningPortal.cpp), which re-enters setup() from a clean boot.
void enterProvisioningMode() {
  Serial.println("[main] entering provisioning mode");
  provisioningModeActive = true;
  provisioningPortal.begin();
  // Static message -- rendered once on entry, not every loop() iteration
  // like render()'s live status, since nothing about it changes while
  // waiting for a /setup submission.
  plantDisplay.renderProvisioning(provisioningApSsid);
}

// One channel's full read-convert-submit cycle -- extracted into its own
// function so loop() can run it once per channel without hand-duplicating
// this ~40-line body 4 times. Every early `return` here only skips the
// rest of *this channel's* cycle; loop() moves on to the next channel
// regardless (see loop() below) -- this is what makes each channel's
// retrier.isPending() gate independent, so one channel's in-flight retry
// never blocks the other three's fresh reads.
//
// Sequential, not concurrent: with up to 4 channels each potentially
// making one blocking, bounded HTTP submission (see ReadingSubmitter's
// 15-second internal timeout) within a single loop() pass, a worst-case
// pass (all 4 channels blocking simultaneously) takes meaningfully longer
// than the single-sensor build's original cycle did. Accepted trade-off
// for this board's scale (4 channels, not dozens) -- see
// firmware/README.md's "Device provisioning" section.
void runChannelCycle(Channel& channel) {
  // Empty deviceId means this channel was never set up (a board can be
  // provisioned with anywhere from 1 to 4 channels configured -- see
  // DeviceConfigStore::load()'s comment) -- skip it entirely rather than
  // reading a sensor that might not even be physically wired and
  // submitting with an empty X-Device-Id/X-Device-Key, which the backend
  // would just reject every cycle.
  if (channel.deviceId[0] == '\0') {
    return;
  }

  channel.retrier.update();
  if (channel.retrier.isPending()) {
    return;
  }

  SoilMoistureSample sample = channel.sensor.read();

  // The correct usage pattern: always check success before touching
  // rawValue. A failed read must never be treated as real data — there is
  // deliberately no code path here that falls back to a fabricated number.
  if (!sample.success) {
    Serial.printf("[%s] Reading FAILED: %s\n", channel.identifier, sample.errorMessage);
    return;
  }

  MoistureReading moisture = convertToMoisturePercent(sample.rawValue, soilCalibration);

  if (!moisture.success) {
    // The raw value is still valid and available here (moisture.rawValue)
    // even though no percentage could be computed — it's just not shown
    // in this demo log line, since there's nothing to report yet without
    // a working calibration.
    Serial.printf("[%s] Conversion FAILED: %s (rawMoisture=%d preserved)\n", channel.identifier,
                  moisture.errorMessage, moisture.rawValue);
    return;
  }

  Serial.printf("[%s] Reading OK: rawMoisture=%d moisturePercent=%.1f\n", channel.identifier,
                moisture.rawValue, moisture.moisturePercent);

  channel.hasLastMoisture = true;
  channel.lastMoisturePercent = static_cast<uint8_t>(moisture.moisturePercent);

  time_t now = time(nullptr);
  if (now < PLAUSIBLE_MIN_EPOCH) {
    Serial.printf("[%s] Skipping reading payload: time not yet synced (NTP pending)\n",
                  channel.identifier);
    return;
  }

  FirmwareReading reading{};
  generateReadingId(reading.readingId);
  strncpy(reading.deviceId, channel.deviceId, sizeof(reading.deviceId) - 1);
  formatIso8601Utc(static_cast<uint32_t>(now), reading.recordedAt);
  reading.rawMoisture = moisture.rawValue;
  reading.moisturePercent = moisture.moisturePercent;
  strncpy(reading.firmwareVersion, FIRMWARE_VERSION, sizeof(reading.firmwareVersion) - 1);
  reading.hasWifiRssi = wifiService.isConnected();
  reading.wifiRssi = WiFi.RSSI();

  char json[FIRMWARE_READING_JSON_BUFFER_SIZE];
  size_t len = serializeFirmwareReading(reading, json, sizeof(json));
  if (len == 0) {
    Serial.printf("[%s] Reading JSON serialization failed (buffer too small)\n", channel.identifier);
    return;
  }
  Serial.printf("[%s] Reading JSON: %s\n", channel.identifier, json);

  // Makes the first submission attempt immediately; if that fails with a
  // retryable outcome, subsequent attempts happen via
  // channel.retrier.update() on later loop() iterations above, reusing
  // this exact same JSON (and therefore the same readingId) each time.
  // Response status/body logging happens inside submit() itself (see
  // ReadingSubmitter.cpp); attempt/give-up logging happens inside
  // ReadingRetrier itself.
  channel.retrier.beginSubmission(json);
}

void setup() {
  Serial.begin(115200);
  delay(500); // let the serial monitor attach before the first log line

  // Initialized unconditionally, before the config-load branch below --
  // a brand-new unit needs the display working too, to show
  // enterProvisioningMode()'s setup-mode message (see PlantDisplay.h's
  // renderProvisioning comment for why the display would otherwise sit
  // blank with no indication it's waiting to be configured).
  plantDisplay.begin();

  snprintf(provisioningApSsid, sizeof(provisioningApSsid), "AINA-Setup-%s", BOARD_IDENTIFIER);

  DeviceConfigStore::Config config;
  if (!deviceConfigStore.load(config)) {
    // Brand-new unit (or one that was explicitly cleared) -- there's
    // nothing to connect with yet, so skip straight to provisioning
    // mode instead of attempting (and endlessly retrying) a Wi-Fi
    // connection with empty credentials.
    Serial.println("[main] no stored Wi-Fi/device config -- starting provisioning mode");
    enterProvisioningMode();
    return;
  }

  strncpy(storedWifiSsid, config.wifiSsid, sizeof(storedWifiSsid) - 1);
  strncpy(storedWifiPassword, config.wifiPassword, sizeof(storedWifiPassword) - 1);

  for (uint8_t i = 0; i < DeviceConfigStore::CHANNEL_COUNT; i++) {
    snprintf(channels[i].identifier, sizeof(channels[i].identifier), "%s-ch%u", BOARD_IDENTIFIER,
             i + 1);
    strncpy(channels[i].deviceId, config.deviceId[i], sizeof(channels[i].deviceId) - 1);
    strncpy(channels[i].deviceKey, config.deviceKey[i], sizeof(channels[i].deviceKey) - 1);
    channels[i].sensor.begin();
  }

  wifiService.begin();

  // Checked once up front so a misconfigured calibration is loud and
  // obvious at startup — convertToMoisturePercent() also re-checks this on
  // every call, so a bad calibration can never silently produce a
  // meaningless percentage even if this warning goes unnoticed.
  if (!soilCalibration.isValid()) {
    Serial.println("*** WARNING: soilCalibration is invalid (dryValue and wetValue must be "
                    "distinct and within 0-4095). Moisture percentages will not be computed "
                    "until this is fixed. ***");
  }
}

void loop() {
  // Provisioning mode owns the loop entirely while active -- no sensor
  // reads, no reading submissions, just serving the setup portal until a
  // successful submission reboots into normal operation (see
  // ProvisioningPortal.cpp's POST /setup handler).
  if (provisioningModeActive) {
    provisioningPortal.update();
    return;
  }

  // Drives connect/reconnect/logging — never blocks, safe to call every
  // iteration regardless of how long the rest of loop() takes.
  wifiService.update();

  // An already-provisioned board that can no longer reach its configured
  // network (moved, router changed, password rotated) falls back into
  // the exact same provisioning mode a brand-new unit starts in, rather
  // than retrying forever -- see WIFI_FAILURE_THRESHOLD_FOR_PROVISIONING's
  // comment and ProvisioningTrigger.h. Board-level: this trips based on
  // the one shared Wi-Fi connection, not any individual channel.
  if (shouldEnterProvisioningMode(wifiService.consecutiveFailedAttempts(),
                                  WIFI_FAILURE_THRESHOLD_FOR_PROVISIONING)) {
    enterProvisioningMode();
    return;
  }

  // Kicked off once, as soon as Wi-Fi first connects — SNTP then syncs
  // asynchronously in the background; time(nullptr) starts returning real
  // wall-clock time once that finishes (checked below via
  // PLAUSIBLE_MIN_EPOCH), typically within a few seconds.
  if (wifiService.isConnected() && !ntpSyncStarted) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    ntpSyncStarted = true;
    Serial.println("[main] NTP sync started");
  }

  // Redrawn every iteration regardless of what happens below (a failed
  // sensor read, a pending retry, ...) so the display always reflects
  // current date/Wi-Fi status and each channel's last real moisture even
  // on a cycle where no new reading was captured for the channel
  // currently shown -- see PlantDisplay.h's rotation/"never fabricate"
  // notes.
  {
    time_t nowForDisplay = time(nullptr);
    PlantDisplay::Status displayStatus{};
    displayStatus.hasTime = nowForDisplay >= PLAUSIBLE_MIN_EPOCH;
    // The offset is only ever applied to what's shown on-screen -- see
    // UTC_OFFSET_SECONDS's comment. nowForDisplay is always comfortably
    // larger than the offset magnitude once hasTime is true, so this
    // never underflows.
    displayStatus.epochSeconds = static_cast<uint32_t>(nowForDisplay + UTC_OFFSET_SECONDS);
    displayStatus.wifiConnected = wifiService.isConnected();
    for (uint8_t i = 0; i < DeviceConfigStore::CHANNEL_COUNT; i++) {
      displayStatus.channels[i].inUse = channels[i].deviceId[0] != '\0';
      displayStatus.channels[i].hasMoisture = channels[i].hasLastMoisture;
      displayStatus.channels[i].moisturePercent = channels[i].lastMoisturePercent;
    }
    plantDisplay.render(displayStatus);
  }

  for (uint8_t i = 0; i < DeviceConfigStore::CHANNEL_COUNT; i++) {
    runChannelCycle(channels[i]);
  }

  delay(LOOP_DELAY_MS);
}
