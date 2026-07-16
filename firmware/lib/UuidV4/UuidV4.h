#pragma once

#include <cstddef>
#include <cstdint>

// RFC 4122 UUID v4 formatting, deliberately with no Arduino dependency
// (like RetryTimer and MoistureCalibration) so it's unit-testable on the
// host machine with deterministic input bytes, instead of only ever being
// trusted because it "looks right" on hardware.
//
// This module only *formats* -- it does not generate randomness itself.
// The caller supplies 16 random bytes (real hardware entropy, e.g.
// esp_random() on the ESP32; a fixed test vector in unit tests); see
// main.cpp for where the real random bytes come from.

// "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" -- 36 characters, not counting the
// null terminator.
constexpr size_t UUID_V4_STRING_LENGTH = 36;

// Formats 16 arbitrary bytes into a UUID v4 string, writing
// UUID_V4_STRING_LENGTH characters plus a null terminator into `out`
// (which must be at least UUID_V4_STRING_LENGTH + 1 bytes). Forces the
// version nibble (4) and variant bits (RFC 4122, "10xx") into the output
// regardless of what's in randomBytes at those positions, so the result is
// always a structurally valid v4 UUID even if the 16 input bytes came from
// a weak or biased source.
void formatUuidV4(const uint8_t randomBytes[16], char* out);
