// Builds the URL ProvisioningPortal's self-served /setup form reads (see
// firmware/lib/ProvisioningPortal/ProvisioningPortal.cpp's handleRoot()) --
// one shared boardIdentifier plus 1-4 channel slots, each carrying that
// channel's server-assigned deviceId/deviceKey. Used both for initial
// board registration (all 4 slots at once) and a single channel's
// credential rotation (one slot) -- one consistent URL scheme for both,
// rather than two components that could drift apart.
//
// Deliberately plain http:// (not https://): this is the device's own
// local SoftAP address (192.168.4.1), never reachable from the public
// internet. Callers must render this as a real <a href> (or a QR code of
// it), never fetch()/XHR it -- this app is served over HTTPS, and
// browsers block a plain-http fetch from an HTTPS page as mixed content;
// only a genuine top-level navigation is exempt.
export type DeviceSetupSlot = {
  slot: number;
  deviceId: string;
  deviceKey: string;
};

export function buildDeviceSetupUrl({
  boardIdentifier,
  slots,
}: {
  boardIdentifier: string;
  slots: DeviceSetupSlot[];
}): string {
  const params = new URLSearchParams({ boardIdentifier });

  for (const { slot, deviceId, deviceKey } of slots) {
    params.set(`deviceId${slot}`, deviceId);
    params.set(`deviceKey${slot}`, deviceKey);
  }

  return `http://192.168.4.1/setup?${params.toString()}`;
}
