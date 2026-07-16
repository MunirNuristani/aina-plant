#pragma once

#include <cstddef>
#include <cstdint>

// ISO 8601 UTC timestamp formatting ("YYYY-MM-DDTHH:MM:SSZ"), deliberately
// with no Arduino dependency (like RetryTimer and MoistureCalibration) --
// unit-testable on the host machine against known epoch values, instead of
// only ever being trusted because it "looks right" on hardware.
//
// Does its own calendar math (proleptic Gregorian, no leap seconds) rather
// than calling gmtime()/gmtime_r(), so behavior is identical and
// independently verifiable on both the natively-tested host build and the
// ESP32 target -- not dependent on whichever C library each platform
// happens to link (newlib on ESP32 vs. the host's libc).

// "YYYY-MM-DDTHH:MM:SSZ" -- 20 characters, not counting the null terminator.
constexpr size_t ISO8601_UTC_STRING_LENGTH = 20;

// Formats a UTC epoch time (seconds since 1970-01-01T00:00:00Z) into an
// ISO 8601 UTC string, writing ISO8601_UTC_STRING_LENGTH characters plus a
// null terminator into `out` (which must be at least
// ISO8601_UTC_STRING_LENGTH + 1 bytes). Matches the backend's expected
// format exactly (see backend/src/validation/reading.ts's
// z.iso.datetime() check) -- always UTC ("Z" suffix), never a local
// offset.
//
// Takes epochSeconds as uint32_t rather than time_t on purpose: time_t is
// commonly a signed 32-bit type, which overflows at 2038-01-19T03:14:07Z
// (the "Y2038 problem"). uint32_t instead covers every date up to
// 2106-02-07T06:28:15Z -- see test_y2038_boundary_still_correct and
// test_max_uint32_epoch in test/test_iso8601/.
void formatIso8601Utc(uint32_t epochSeconds, char* out);

// The individual calendar/clock components of an epoch time -- for
// callers that need year/month/day/hour/minute/second separately rather
// than a pre-formatted ISO string (e.g. PlantDisplay's non-ISO date
// format). Shares the exact same calendar math as formatIso8601Utc()
// internally, so the two can never disagree with each other.
struct CivilDateTime {
  int year;
  unsigned month;   // 1-12
  unsigned day;     // 1-31 (day of month)
  unsigned hour;    // 0-23
  unsigned minute;  // 0-59
  unsigned second;  // 0-59
};

// Breaks epochSeconds down into its calendar components. Like
// formatIso8601Utc(), this always treats epochSeconds as a UTC value --
// if a caller wants a *localized* date/time, it's their job to add a
// timezone offset to epochSeconds before calling this (see
// firmware/src/main.cpp's UTC_OFFSET_SECONDS for where this project does
// that, and why it's a fixed manually-set offset rather than automatic
// DST handling).
CivilDateTime toCivilDateTime(uint32_t epochSeconds);
