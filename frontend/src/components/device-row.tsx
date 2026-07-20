import Link from "next/link";
import { Clock, PowerOff, Radio, Unlink, Wifi, WifiOff } from "lucide-react";
import type { ComponentType } from "react";
import { formatRelativeTime } from "@/lib/format";
import { computeDeviceStatus, type DeviceStatus } from "@/lib/device-status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DeviceListItem } from "@/lib/types";

type BadgeTone = "healthy" | "warning" | "critical" | "neutral";

const STATUS_META: Record<
  DeviceStatus,
  { tone: BadgeTone; icon: ComponentType<{ size?: number }>; label: string }
> = {
  online: { tone: "healthy", icon: Wifi, label: "Online" },
  delayed: { tone: "warning", icon: Clock, label: "Delayed" },
  offline: { tone: "critical", icon: WifiOff, label: "Offline" },
  "never-connected": { tone: "neutral", icon: Radio, label: "Never connected" },
  "no-device": { tone: "neutral", icon: Unlink, label: "No device" },
};

const DISABLED_META = { tone: "neutral" as BadgeTone, icon: PowerOff, label: "Disabled" };

export function DeviceRow({ device }: { device: DeviceListItem }) {
  // Disabled overrides the online/offline computation entirely -- an
  // intentionally-off device isn't "offline" in the alarming sense.
  const meta = !device.enabled ? DISABLED_META : STATUS_META[computeDeviceStatus(device)];
  const Icon = meta.icon;

  return (
    <Link href={`/devices/${device.id}`}>
      <Card interactive>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-text-primary [font:var(--text-heading-s)]">{device.identifier}</span>
            <span className="text-text-muted [font:var(--text-body-s)]">
              {device.plant ? `Assigned to ${device.plant.name}` : "Not assigned to a plant"}
            </span>
            <span className="text-text-muted [font:var(--text-body-s)]">
              Last seen {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : "never"}
            </span>
          </div>
          <Badge tone={meta.tone}>
            <span className="inline-flex items-center gap-1">
              <Icon size={11} />
              {meta.label}
            </span>
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
