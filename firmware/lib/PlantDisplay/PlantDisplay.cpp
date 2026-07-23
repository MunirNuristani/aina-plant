#include "PlantDisplay.h"

#include "Iso8601.h"
#include "RetryTimer.h"  // reuses shouldRetryNow()'s overflow-safe elapsed-time check for the channel-rotation dwell timer

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

  // Line 1: rotates through whichever channels are actually in use
  // (skipping any never set up -- see ChannelStatus::inUse), one at a
  // time, advancing every CHANNEL_DWELL_MS -- e.g. "Plant 2  S:52%"
  // (14 chars) or "Plant 4  S:100%" (15 chars) worst case, both fit. No
  // clock here anymore (see this class's header comment for why it was
  // dropped) -- the date on line 0 already covers "what day is it," and
  // there's no room left on this line once a plant label and its
  // moisture share it.
  uint32_t now = millis();
  bool dwellElapsed = shouldRetryNow(now, lastChannelCycleMs_, CHANNEL_DWELL_MS);

  // Also advances immediately (not just on the dwell timer) when the
  // currently-shown slot isn't in use -- covers the very first render()
  // call before any rotation has happened yet, if channel 0 itself was
  // never set up. If no channel is in use at all, this loop's CHANNEL_COUNT
  // advances land back on the same index it started from (unchanged).
  if (dwellElapsed || !status.channels[currentChannelIndex_].inUse) {
    for (uint8_t attempts = 0; attempts < CHANNEL_COUNT; attempts++) {
      currentChannelIndex_ = (currentChannelIndex_ + 1) % CHANNEL_COUNT;
      if (status.channels[currentChannelIndex_].inUse) break;
    }
    lastChannelCycleMs_ = now;
  }

  const ChannelStatus& channel = status.channels[currentChannelIndex_];
  char line1[17];
  if (!channel.inUse) {
    snprintf(line1, sizeof(line1), "No sensors set up");
  } else {
    char moisture[6];
    if (channel.hasMoisture) {
      snprintf(moisture, sizeof(moisture), "%u%%", channel.moisturePercent);
    } else {
      snprintf(moisture, sizeof(moisture), "--");
    }
    snprintf(line1, sizeof(line1), "Plant %u  S:%s", currentChannelIndex_ + 1, moisture);
  }

  clearRow(0);
  lcd_.setCursor(0, 0);
  lcd_.print(line0);

  clearRow(1);
  lcd_.setCursor(0, 1);
  lcd_.print(line1);

  Serial.printf("[PlantDisplay] \"%s\" / \"%s\"\n", line0, line1);
}

void PlantDisplay::renderProvisioning(const char* apSsid) {
  clearRow(0);
  lcd_.setCursor(0, 0);
  lcd_.print("Wi-Fi setup mode");

  clearRow(1);
  lcd_.setCursor(0, 1);
  lcd_.print("Join: ");

  // Truncated to whatever fits after "Join: " (6 characters) -- not
  // scrolled, see PlantDisplay.h's renderProvisioning comment.
  uint8_t labelWidth = 6;
  uint8_t remaining = columns_ > labelWidth ? columns_ - labelWidth : 0;
  for (uint8_t i = 0; i < remaining && apSsid[i] != '\0'; i++) {
    lcd_.print(apSsid[i]);
  }

  Serial.printf("[PlantDisplay] provisioning mode, AP: %s\n", apSsid);
}
