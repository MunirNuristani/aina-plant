#include "PlantDisplay.h"

#include "Iso8601.h"

namespace {

// toCivilDateTime() returns month as 1-12; index with month - 1.
const char* const MONTH_ABBREVIATIONS[12] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};

}  // namespace

PlantDisplay::PlantDisplay(uint8_t i2cAddress, uint8_t columns, uint8_t rows, uint8_t sdaPin,
                           uint8_t sclPin)
    : lcd_(i2cAddress, columns, rows), columns_(columns), sdaPin_(sdaPin), sclPin_(sclPin) {}

void PlantDisplay::begin() {
  Wire.begin(sdaPin_, sclPin_);
  lcd_.init();
  lcd_.backlight();
  clearRow(0);
  clearRow(1);
  Serial.println("[PlantDisplay] initialized");
}

void PlantDisplay::clearRow(uint8_t row) {
  lcd_.setCursor(0, row);
  for (uint8_t i = 0; i < columns_; i++) {
    lcd_.print(' ');
  }
}

void PlantDisplay::render(const Status& status) {
  // Line 0: date ("MMM, dd YYYY", always exactly 12 characters since
  // month abbreviations are fixed-width) plus a short Wi-Fi indicator --
  // e.g. "Jul, 16 2026 OK" (15 chars, fits the 16-column budget with
  // room to spare regardless of day/month/year width).
  char line0[17];
  if (status.hasTime) {
    CivilDateTime dt = toCivilDateTime(status.epochSeconds);
    const char* month =
        (dt.month >= 1 && dt.month <= 12) ? MONTH_ABBREVIATIONS[dt.month - 1] : "???";
    snprintf(line0, sizeof(line0), "%s, %02u %d %s", month, dt.day, dt.year,
             status.wifiConnected ? "OK" : "--");
  } else {
    snprintf(line0, sizeof(line0), "Time syncing...");
  }

  // Line 1: 12-hour clock ("H:MM AM/PM", space-padded to a consistent
  // width regardless of whether the hour is one or two digits) plus soil
  // moisture -- e.g. "10:23 PM  S:52%". Worst case ("12:59 PM  S:100%")
  // is exactly 16 characters, still fits.
  char line1[17];
  if (status.hasTime) {
    CivilDateTime dt = toCivilDateTime(status.epochSeconds);
    unsigned hour12 = dt.hour % 12;
    if (hour12 == 0) hour12 = 12;
    const char* ampm = dt.hour < 12 ? "AM" : "PM";

    char moisture[6];
    if (status.hasMoisture) {
      snprintf(moisture, sizeof(moisture), "%u%%", status.moisturePercent);
    } else {
      snprintf(moisture, sizeof(moisture), "--");
    }
    snprintf(line1, sizeof(line1), "%2u:%02u %s  S:%s", hour12, dt.minute, ampm, moisture);
  } else if (status.hasMoisture) {
    snprintf(line1, sizeof(line1), "Soil:%u%%", status.moisturePercent);
  } else {
    snprintf(line1, sizeof(line1), "Soil:--");
  }

  clearRow(0);
  lcd_.setCursor(0, 0);
  lcd_.print(line0);

  clearRow(1);
  lcd_.setCursor(0, 1);
  lcd_.print(line1);

  Serial.printf("[PlantDisplay] \"%s\" / \"%s\"\n", line0, line1);
}
