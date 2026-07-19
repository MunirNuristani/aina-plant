import { formatRelativeTime } from "@/lib/format";
import { computeDeviceStatus, DEVICE_STATUS_COPY } from "@/lib/device-status";
import type { Device } from "@/lib/types";

export function DeviceStatusBadge({ device }: { device: Device | undefined }) {
  const status = computeDeviceStatus(device);
  const copy = DEVICE_STATUS_COPY[status];
  const lastSeenAt = device?.lastSeenAt;

  return (
    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
      {/* Status color lives on the dot only — text stays neutral ink, since
          Golden Pollen (warning) fails WCAG text contrast outright as text. */}
      <span className="flex items-center gap-1.5 text-ink">
        <span className={`h-1.5 w-1.5 rounded-full ${copy.dotClass}`} aria-hidden="true" />
        {copy.label}
      </span>
      {lastSeenAt ? (
        <span className="normal-case tracking-normal text-ink-muted">
          &middot; Last reading {formatRelativeTime(lastSeenAt)}
        </span>
      ) : null}
    </div>
  );
}
