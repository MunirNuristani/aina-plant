#include "Iso8601.h"

#include <cstdio>

namespace {

// Howard Hinnant's civil_from_days algorithm: converts a day count (days
// since 1970-01-01) into a proleptic Gregorian (year, month, day). A
// well-known, thoroughly-verified algorithm -- not reinvented here. See
// https://howardhinnant.github.io/date_algorithms.html for the derivation.
void civilFromDays(int64_t z, int& year, unsigned& month, unsigned& day) {
  z += 719468;
  const int64_t era = (z >= 0 ? z : z - 146096) / 146097;
  const unsigned doe = static_cast<unsigned>(z - era * 146097);                // [0, 146096]
  const unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;  // [0, 399]
  const int64_t y = static_cast<int64_t>(yoe) + era * 400;
  const unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);  // [0, 365]
  const unsigned mp = (5 * doy + 2) / 153;                       // [0, 11]
  day = doy - (153 * mp + 2) / 5 + 1;                            // [1, 31]
  month = mp + (mp < 10 ? 3 : -9);                               // [1, 12]
  year = static_cast<int>(y + (month <= 2 ? 1 : 0));
}

}  // namespace

CivilDateTime toCivilDateTime(uint32_t epochSeconds) {
  const int64_t days = static_cast<int64_t>(epochSeconds) / 86400;
  const uint32_t secondsOfDay = epochSeconds % 86400;

  CivilDateTime result{};
  civilFromDays(days, result.year, result.month, result.day);
  result.hour = secondsOfDay / 3600;
  result.minute = (secondsOfDay % 3600) / 60;
  result.second = secondsOfDay % 60;
  return result;
}

void formatIso8601Utc(uint32_t epochSeconds, char* out) {
  const CivilDateTime dt = toCivilDateTime(epochSeconds);
  std::snprintf(out, ISO8601_UTC_STRING_LENGTH + 1, "%04d-%02u-%02uT%02u:%02u:%02uZ", dt.year,
                dt.month, dt.day, dt.hour, dt.minute, dt.second);
}
