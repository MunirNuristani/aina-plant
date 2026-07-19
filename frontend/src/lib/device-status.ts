import type { Device } from "./types";

export type DeviceStatus = "online" | "delayed" | "offline" | "never-connected" | "no-device";

// Two thresholds off the device's own configured reporting cadence — "did it
// miss its next check-in" (online→delayed) and "has it clearly stopped
// reporting" (delayed→offline) — each floored so a very short reporting
// interval doesn't flag a device offline after a single network blip.
const ONLINE_MULTIPLIER = 1.5;
const DELAYED_MULTIPLIER = 4;
const MIN_ONLINE_THRESHOLD_SECONDS = 5 * 60;
const MIN_DELAYED_THRESHOLD_SECONDS = 30 * 60;

// A plant's `devices` array only ever contains its currently-ENABLED
// device (the backend filters disabled ones out at the query level, and
// there is no endpoint to look one up independently) — so `undefined` here
// is genuinely ambiguous between "no device was ever assigned" and "a
// device is assigned but disabled." Both currently render as "no-device";
// see NOTES on the device-status feature for why a true "disabled" status
// isn't distinguishable from the frontend today.
export function computeDeviceStatus(device: Device | undefined): DeviceStatus {
  if (!device) {
    return "no-device";
  }

  if (!device.lastSeenAt) {
    return "never-connected";
  }

  const ageSeconds = (Date.now() - new Date(device.lastSeenAt).getTime()) / 1000;
  const onlineThreshold = Math.max(device.reportingIntervalSeconds * ONLINE_MULTIPLIER, MIN_ONLINE_THRESHOLD_SECONDS);
  const delayedThreshold = Math.max(
    device.reportingIntervalSeconds * DELAYED_MULTIPLIER,
    MIN_DELAYED_THRESHOLD_SECONDS,
  );

  if (ageSeconds <= onlineThreshold) {
    return "online";
  }
  if (ageSeconds <= delayedThreshold) {
    return "delayed";
  }
  return "offline";
}

// dotClass only — status color belongs on the small identity dot, never on
// the label text (see device-status-badge.tsx; Golden Pollen in particular
// fails WCAG text contrast outright as text color).
export const DEVICE_STATUS_COPY: Record<DeviceStatus, { label: string; dotClass: string }> = {
  online: { label: "Online", dotClass: "bg-success" },
  delayed: { label: "Delayed", dotClass: "bg-warning" },
  offline: { label: "Offline", dotClass: "bg-error" },
  "never-connected": { label: "Never connected", dotClass: "bg-ink-muted" },
  "no-device": { label: "No device assigned", dotClass: "bg-ink-muted" },
};
