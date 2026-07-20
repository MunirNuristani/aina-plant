import Link from "next/link";
import { Clock, Radio, Unlink, Wifi, WifiOff } from "lucide-react";
import type { ComponentType } from "react";
import { formatRelativeTime } from "@/lib/format";
import { computeDeviceStatus, type DeviceStatus } from "@/lib/device-status";
import {
  DEFAULT_REPORTING_INTERVAL_SECONDS,
  isReadingStale,
  moistureLevel,
  MOISTURE_LEVEL_TO_PILL_STATUS,
} from "@/lib/moisture";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import type { Plant, SensorReading } from "@/lib/types";

type BadgeTone = "healthy" | "warning" | "critical" | "neutral";

const DEVICE_BADGE_META: Record<
  DeviceStatus,
  { tone: BadgeTone; icon: ComponentType<{ size?: number }>; label: string }
> = {
  online: { tone: "healthy", icon: Wifi, label: "Online" },
  delayed: { tone: "warning", icon: Clock, label: "Delayed" },
  offline: { tone: "critical", icon: WifiOff, label: "Offline" },
  "never-connected": { tone: "neutral", icon: Radio, label: "Never connected" },
  "no-device": { tone: "neutral", icon: Unlink, label: "No device" },
};

export function PlantCard({
  plant,
  latestReading,
}: {
  plant: Plant;
  latestReading: SensorReading | null;
}) {
  const device = plant.devices[0];
  const deviceStatus = computeDeviceStatus(device);
  const deviceMeta = DEVICE_BADGE_META[deviceStatus];
  const DeviceIcon = deviceMeta.icon;

  const hasMoisture = latestReading !== null;
  const pillStatus = latestReading ? MOISTURE_LEVEL_TO_PILL_STATUS[moistureLevel(latestReading.moisturePercent)] : null;
  const stale = latestReading
    ? isReadingStale(latestReading, device?.reportingIntervalSeconds ?? DEFAULT_REPORTING_INTERVAL_SECONDS)
    : false;

  const noReadingText = !device
    ? "No device paired"
    : deviceStatus === "never-connected"
      ? "Waiting for first reading"
      : "No reading yet";

  return (
    <Link
      href={`/plants/${plant.id}`}
      className="group flex flex-col gap-3 rounded-m border border-border-default bg-surface-card p-5 shadow-card transition-shadow duration-200 ease-[var(--ease-standard)] hover:shadow-raised"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-text-primary [font:var(--text-heading-s)]">{plant.name}</span>
          {plant.location ? (
            <span className="text-text-muted [font:var(--text-body-s)]">{plant.location}</span>
          ) : null}
        </div>
        {pillStatus ? <StatusPill status={pillStatus} /> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Badge tone={deviceMeta.tone}>
          <span className="inline-flex items-center gap-1">
            <DeviceIcon size={11} />
            {deviceMeta.label}
          </span>
        </Badge>
        {hasMoisture && latestReading ? (
          <span className="flex items-baseline gap-1">
            <span className="text-text-primary [font:var(--text-mono-l)]">
              {latestReading.moisturePercent.toFixed(0)}
            </span>
            <span className="text-text-muted [font:var(--text-body-s)]">% moisture</span>
          </span>
        ) : (
          <span className="text-text-muted [font:var(--text-body-s)]">{noReadingText}</span>
        )}
      </div>

      {latestReading ? (
        <div className="flex items-center gap-2">
          <span className="text-text-muted [font:var(--text-body-s)]">
            as of {formatRelativeTime(latestReading.recordedAt)}
          </span>
          {stale ? (
            <span className="rounded-pill bg-status-warning-bg px-2 py-0.5 uppercase tracking-[var(--tracking-label)] text-status-warning-fg [font:var(--text-label)]">
              Stale
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
