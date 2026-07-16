#include "UuidV4.h"

namespace {

char hexDigit(uint8_t nibble) {
  return nibble < 10 ? char('0' + nibble) : char('a' + (nibble - 10));
}

char* writeHexByte(char* dest, uint8_t byte) {
  *dest++ = hexDigit(byte >> 4);
  *dest++ = hexDigit(byte & 0x0F);
  return dest;
}

}  // namespace

void formatUuidV4(const uint8_t randomBytes[16], char* out) {
  uint8_t bytes[16];
  for (int i = 0; i < 16; i++) {
    bytes[i] = randomBytes[i];
  }

  // Version 4: top nibble of byte 6 fixed to 0100.
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  // Variant (RFC 4122): top two bits of byte 8 fixed to 10.
  bytes[8] = (bytes[8] & 0x3F) | 0x80;

  char* p = out;
  for (int i = 0; i < 4; i++) p = writeHexByte(p, bytes[i]);
  *p++ = '-';
  for (int i = 4; i < 6; i++) p = writeHexByte(p, bytes[i]);
  *p++ = '-';
  for (int i = 6; i < 8; i++) p = writeHexByte(p, bytes[i]);
  *p++ = '-';
  for (int i = 8; i < 10; i++) p = writeHexByte(p, bytes[i]);
  *p++ = '-';
  for (int i = 10; i < 16; i++) p = writeHexByte(p, bytes[i]);
  *p = '\0';
}
