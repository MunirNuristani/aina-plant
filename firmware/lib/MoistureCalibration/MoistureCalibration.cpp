#include "MoistureCalibration.h"

MoistureReading convertToMoisturePercent(int rawValue, const MoistureCalibration& calibration) {
  if (!calibration.isValid()) {
    return MoistureReading{
        false, rawValue, 0.0f,
        "invalid calibration: dryValue and wetValue must be distinct and within [0, 4095]"};
  }

  float range = static_cast<float>(calibration.dryValue - calibration.wetValue);
  float percent = (static_cast<float>(calibration.dryValue - rawValue) / range) * 100.0f;

  if (percent < 0.0f) {
    percent = 0.0f;
  } else if (percent > 100.0f) {
    percent = 100.0f;
  }

  return MoistureReading{true, rawValue, percent, nullptr};
}
