#pragma once

#include <cstdint>

// Pure decision logic, deliberately with no Arduino dependency, so it can
// be unit-tested on the host machine (see test/test_provisioning_trigger/)
// instead of only ever being trusted because it "looks right" -- mirrors
// RetryTimer's split of "policy" from the hardware-touching code that
// acts on it.
//
// The caller (main.cpp) tracks consecutiveFailedAttempts via
// WifiService::consecutiveFailedAttempts() and decides, once per loop()
// iteration, whether it's time to give up on the currently-configured
// Wi-Fi credentials and fall back into ProvisioningPortal's SoftAP setup
// mode -- this is the same mechanism used for a brand-new, never-
// configured unit (which starts in provisioning mode directly, never
// calling this at all) and for an already-provisioned unit that can no
// longer reach its configured network (moved, router changed, password
// rotated) -- both end up in the identical provisioning mode, just
// triggered from a different call site in main.cpp.
inline bool shouldEnterProvisioningMode(uint32_t consecutiveFailedAttempts, uint32_t failureThreshold) {
  return consecutiveFailedAttempts >= failureThreshold;
}
