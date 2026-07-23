#pragma once

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>
#include <cstdint>

// Drives an I2C character LCD (the same PCF8574-backed HD44780 module the
// old aina_core.ino sketch used -- LiquidCrystal_I2C, address 0x27,
// wired to the ESP32's default I2C pins 21/22) to show live board
// status at a glance: synced date, Wi-Fi connectivity, and each of the
// 4 soil-moisture channels' current reading (one at a time -- see
// render()'s line 2 rotation below).
//
// Deliberately no animation or decoration (contrast with aina_core.ino's
// worm/plant-growth idle animation) -- this is a status readout, not a
// demo. Two lines of sixteen characters isn't much room, so only what's
// directly useful is shown; rotating which channel occupies line 2 is a
// concession to that constraint, not decoration -- it's still a full
// redraw of real data each time, never a transition/animation.
//
// Never fabricates a value it doesn't have: Status::hasTime/
// ChannelStatus::hasMoisture distinguish "not available right now" (NTP
// hasn't synced yet; a channel's reading was skipped or failed this
// cycle) from a real value -- the same "never invent data" principle
// SoilMoistureSensor and MoistureCalibration apply to their own results.
// The caller (main.cpp) is expected to keep showing each channel's last
// *real* known moisture reading across cycles where a new one wasn't
// captured, rather than this module inventing one.
class PlantDisplay {
public:
  // Fixed at 4 -- this board is exactly 4 soil-moisture channels (see
  // DeviceConfigStore::CHANNEL_COUNT), not a generic N-channel display.
  static constexpr uint8_t CHANNEL_COUNT = 4;

  struct ChannelStatus {
    // False for a channel that's never been set up (no deviceId
    // provisioned for it -- see DeviceConfigStore::load()'s comment on
    // why a board can run with anywhere from 1 to 4 channels configured).
    // render()'s rotation skips channels where this is false, rather
    // than cycling through slots that will never have real data.
    bool inUse;

    bool hasMoisture;
    uint8_t moisturePercent;  // 0-100; only meaningful if hasMoisture
  };

  struct Status {
    bool hasTime;

    // A seconds-since-epoch value to render as a calendar date -- NOT
    // necessarily true UTC. This module has no timezone awareness of
    // its own; it always renders whatever value it's given using UTC
    // calendar math (via Iso8601's toCivilDateTime()). The caller
    // (main.cpp) is responsible for adding a timezone offset before
    // setting this field, if a localized display is wanted -- see
    // main.cpp's UTC_OFFSET_SECONDS.
    uint32_t epochSeconds;

    bool wifiConnected;

    // Indexed the same way as main.cpp's `channels` array (0 = the
    // first physical sensor). render() cycles which one of these 4
    // occupies line 2 -- see render()'s comment below.
    ChannelStatus channels[CHANNEL_COUNT];
  };

  // i2cAddress: the LCD backpack's I2C address -- 0x27 and 0x3F are the
  //   two overwhelmingly common defaults for PCF8574-based backpacks; if
  //   the display stays blank, an I2C scanner sketch will find the real
  //   address.
  // columns/rows: character grid size. This module's layout assumes at
  //   least 16 columns and 2 rows (a larger display, e.g. 20x4, just
  //   leaves the extra space blank) -- not hardcoded, so a different
  //   panel size doesn't require editing this class.
  // sdaPin/sclPin: ESP32 I2C bus pins -- 21/22 are the DevKit's
  //   conventional default, matching aina_core.ino's Wire.begin(21, 22).
  explicit PlantDisplay(uint8_t i2cAddress = 0x27, uint8_t columns = 16, uint8_t rows = 2,
                        uint8_t sdaPin = 21, uint8_t sclPin = 22);

  // Initializes the I2C bus and the LCD. Call once from setup().
  void begin();

  // Redraws both rows from scratch: each row is fully blanked first, so
  // a shorter new string never leaves stale characters from a longer
  // previous one behind. Cheap enough to call every loop() iteration.
  void render(const Status& status);

  // Shown instead of render()'s normal readout while ProvisioningPortal's
  // setup mode is active (see main.cpp's provisioningModeActive) -- the
  // display would otherwise sit blank/uninitialized with zero indication
  // the device is waiting to be configured. apSsid is truncated (not
  // scrolled -- see this class's "no animation or decoration" note
  // above) to whatever fits after the "Join: " label; the network's
  // "AINA-Setup-" prefix is still recognizable even when the full
  // identifier doesn't fit. Static content -- call once when entering
  // provisioning mode, not every loop() iteration like render().
  void renderProvisioning(const char* apSsid);

private:
  // How long each channel stays on line 2 before render() advances to
  // the next one -- a fixed dwell, not a smooth scroll/transition (see
  // this class's "no animation" note above).
  static constexpr uint32_t CHANNEL_DWELL_MS = 3000;

  LiquidCrystal_I2C lcd_;
  uint8_t columns_;
  uint8_t sdaPin_;
  uint8_t sclPin_;

  // Which of the 4 channels currently occupies line 2, and when render()
  // last advanced it -- render() is the only thing that mutates these,
  // once per call, based on elapsed millis().
  uint8_t currentChannelIndex_ = 0;
  uint32_t lastChannelCycleMs_ = 0;

  void clearRow(uint8_t row);
};
