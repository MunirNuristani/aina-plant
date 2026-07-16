#include "SoilMoistureSensor.h"

SoilMoistureSensor::SoilMoistureSensor(uint8_t pin, uint8_t sampleCount, uint16_t sampleDelayMs,
                                       int maxSampleSpread)
    : pin_(pin),
      sampleCount_(min(sampleCount, SOIL_SENSOR_MAX_SAMPLE_COUNT)),
      sampleDelayMs_(sampleDelayMs),
      maxSampleSpread_(maxSampleSpread) {}

void SoilMoistureSensor::begin() {
  pinMode(pin_, INPUT);
  // Explicit rather than relying on the core's default, so this reading's
  // 0-4095 range is guaranteed regardless of the Arduino-ESP32 core version.
  analogReadResolution(12);

  Serial.printf("[SoilMoistureSensor] pin=%u sampleCount=%u sampleDelayMs=%u maxSampleSpread=%d\n",
                pin_, sampleCount_, sampleDelayMs_, maxSampleSpread_);
}

SoilMoistureSample SoilMoistureSensor::read() {
  // Fixed-size stack buffer (see SOIL_SENSOR_MAX_SAMPLE_COUNT) — avoids a
  // variable-length array while keeping the actual stack usage small
  // regardless of how high sampleCount could theoretically go.
  int samples[SOIL_SENSOR_MAX_SAMPLE_COUNT];

  int minSample = SOIL_SENSOR_ADC_MAX;
  int maxSample = 0;

  for (uint8_t i = 0; i < sampleCount_; i++) {
    int value = analogRead(pin_);
    samples[i] = value;

    if (value < minSample) minSample = value;
    if (value > maxSample) maxSample = value;

    Serial.printf("[SoilMoistureSensor] sample %u/%u = %d\n", i + 1, sampleCount_, value);

    if (i + 1 < sampleCount_) {
      delay(sampleDelayMs_);
    }
  }

  // analogRead() has no error return on ESP32 — a disconnected, shorted,
  // or otherwise faulty sensor still returns a plausible-looking int. The
  // only way to detect a bad reading here is to sanity-check the samples
  // themselves, not to look for a hardware fault code.

  bool allMin = (minSample == 0 && maxSample == 0);
  bool allMax = (minSample == SOIL_SENSOR_ADC_MAX && maxSample == SOIL_SENSOR_ADC_MAX);

  if (allMin) {
    Serial.println("[SoilMoistureSensor] read failed: all samples at 0 (pin likely grounded or "
                    "sensor disconnected)");
    return SoilMoistureSample{false, -1,
                               "all samples at 0 (pin likely grounded or sensor disconnected)"};
  }

  if (allMax) {
    Serial.printf("[SoilMoistureSensor] read failed: all samples at max (%d) (pin likely "
                  "floating or shorted to VCC)\n",
                  SOIL_SENSOR_ADC_MAX);
    return SoilMoistureSample{false, -1, "all samples at max (pin likely floating or shorted to VCC)"};
  }

  int spread = maxSample - minSample;
  if (spread > maxSampleSpread_) {
    Serial.printf(
        "[SoilMoistureSensor] read failed: sample spread %d exceeds max %d (unstable reading, "
        "check wiring)\n",
        spread, maxSampleSpread_);
    return SoilMoistureSample{false, -1, "sample spread too large (unstable reading, check wiring)"};
  }

  int median = computeMedian(samples, sampleCount_);
  Serial.printf("[SoilMoistureSensor] filtered (median) value = %d\n", median);

  return SoilMoistureSample{true, median, nullptr};
}

int SoilMoistureSensor::computeMedian(int* samples, uint8_t count) const {
  // Simple insertion sort: sampleCount_ is small (single digits to a few
  // dozen at most), so this is fast enough and avoids pulling in <algorithm>
  // for one small array.
  for (uint8_t i = 1; i < count; i++) {
    int key = samples[i];
    int j = i;
    while (j > 0 && samples[j - 1] > key) {
      samples[j] = samples[j - 1];
      j--;
    }
    samples[j] = key;
  }

  if (count % 2 == 1) {
    return samples[count / 2];
  }
  return (samples[count / 2 - 1] + samples[count / 2]) / 2;
}
