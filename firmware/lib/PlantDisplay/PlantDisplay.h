#pragma once

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>
#include <cstdint>

// Drives an I2C character LCD (the same PCF8574-backed HD44780 module the
// old aina_core.ino sketch used -- LiquidCrystal_I2C, address 0x27,
// wired to the ESP32's default I2C pins 21/22) to show live device
// status at a glance: synced date/time, current soil moisture, and Wi-Fi
// connectivity.
//
// Deliberately no animation or decoration (contrast with aina_core.ino's
// worm/plant-growth idle animation) -- this is a status readout, not a
// demo. Two lines of sixteen characters isn't much room, so only what's
// directly useful is shown.
//
// Never fabricates a value it doesn't have: Status::hasTime/hasMoisture
// distinguish "not available right now" (NTP hasn't synced yet; a
// reading was skipped or failed this cycle) from a real value -- the same
// "never invent data" principle SoilMoistureSensor and MoistureCalibration
// apply to their own results. The caller (main.cpp) is expected to keep
// showing its last *real* known moisture reading across cycles where a
// new one wasn't captured, rather than this module inventing one.
class PlantDisplay {
public:
  struct Status {
    bool hasTime;

    // A seconds-since-epoch value to render as a clock/calendar date --
    // NOT necessarily true UTC. This module has no timezone awareness of
    // its own; it always renders whatever value it's given using UTC
    // calendar math (via Iso8601's toCivilDateTime()). The caller
    // (main.cpp) is responsible for adding a timezone offset before
    // setting this field, if a localized display is wanted -- see
    // main.cpp's UTC_OFFSET_SECONDS.
    uint32_t epochSeconds;

    bool hasMoisture;
    uint8_t moisturePercent;  // 0-100; only meaningful if hasMoisture

    bool wifiConnected;
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

private:
  LiquidCrystal_I2C lcd_;
  uint8_t columns_;
  uint8_t sdaPin_;
  uint8_t sclPin_;

  void clearRow(uint8_t row);
};
