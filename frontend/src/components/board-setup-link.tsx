import { QRCodeSVG } from "qrcode.react";
import { buildDeviceSetupUrl, type DeviceSetupSlot } from "@/lib/device-setup-url";

// Shown right after a board's channels are registered (or one channel's
// credential rotated -- see device-detail-controls.tsx's "Reconfigure
// Wi-Fi"): the board itself has no Wi-Fi yet, so it's hosting its own
// temporary open network and a small setup form at
// http://192.168.4.1/setup (see firmware/lib/ProvisioningPortal/). The
// link/QR below carries boardIdentifier plus each slot's
// deviceId/deviceKey as query params so the device's form can prefill
// them -- the user only has to join that network first and then enter
// their home Wi-Fi's SSID/password.
//
// The tappable link below is a plain <a>, deliberately not the Button
// component (which renders a <button>, not a real anchor) or router.push
// -- this app is served over HTTPS, so it can't fetch()/XHR a plain-http
// URL (blocked as mixed content), but a genuine top-level navigation to
// one is not blocked. The QR code encodes the identical URL as a second
// way to reach it (e.g. if the PWA tab gets backgrounded during the
// Wi-Fi switch).
export function BoardSetupLink({
  boardIdentifier,
  slots,
}: {
  boardIdentifier: string;
  slots: DeviceSetupSlot[];
}) {
  const setupUrl = buildDeviceSetupUrl({ boardIdentifier, slots });
  const apName = `AINA-Setup-${boardIdentifier}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 rounded-m border border-border-default bg-surface-card p-4 text-left">
        <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
          Connect the device to Wi-Fi
        </p>
        <ol className="list-decimal pl-4 text-text-primary [font:var(--text-body-m)]">
          <li>
            On your phone, join the Wi-Fi network <strong>{apName}</strong> (no password).
          </li>
          <li>Then tap the link below, or scan the QR code, to finish setup.</li>
        </ol>
      </div>

      <a
        href={setupUrl}
        className="inline-flex items-center justify-center gap-2 rounded-m border border-transparent bg-action-primary px-[18px] py-[11px] text-center text-text-on-primary [font:var(--text-heading-s)] transition-colors hover:bg-action-primary-hover"
      >
        Open device setup
      </a>

      <div className="flex justify-center rounded-m border border-border-default bg-surface-card p-4">
        <QRCodeSVG value={setupUrl} size={160} />
      </div>
    </div>
  );
}
