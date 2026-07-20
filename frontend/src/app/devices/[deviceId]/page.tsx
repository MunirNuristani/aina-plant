import { notFound } from "next/navigation";
import { Cpu } from "lucide-react";
import { BackHeader } from "@/components/back-header";
import { DeviceDetailControls } from "@/components/device-detail-controls";
import { Card } from "@/components/ui/card";
import { computeDeviceStatus, DEVICE_STATUS_COPY } from "@/lib/device-status";
import { formatDateTime } from "@/lib/format";
import { getDevice } from "@/lib/devices";
import { getPlants } from "@/lib/plants";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const [device, plants] = await Promise.all([getDevice(deviceId), getPlants()]);

  if (!device) {
    notFound();
  }

  const status = computeDeviceStatus(device);
  const statusCopy = DEVICE_STATUS_COPY[status];
  const unassignedPlants = plants.filter((plant) => plant.devices.length === 0);

  const description = !device.enabled
    ? "Monitoring disabled — turn the device back on to resume tracking."
    : status === "never-connected"
      ? "Never connected — waiting for the first reading since pairing."
      : device.lastSeenAt
        ? `${statusCopy.label} — last reading ${formatDateTime(device.lastSeenAt)}.`
        : `${statusCopy.label}.`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <BackHeader backHref="/devices" title={device.identifier} />

      <Card>
        <div className="flex items-start gap-3">
          <Cpu size={20} className="mt-0.5 shrink-0 text-text-secondary" />
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-text-primary [font:var(--text-heading-s)]">{device.name}</span>
            <span className="text-text-secondary [font:var(--text-body-m)]">{description}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3.5">
          <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
            Device details
          </p>
          <DetailRow label="Assigned plant" value={device.plant?.name ?? "Not assigned"} />
          <DetailRow label="Firmware" value={device.firmwareVersion ?? "—"} mono />
          <DetailRow label="Reporting interval" value={`Every ${device.reportingIntervalSeconds}s`} mono />
          {/* No backend endpoint exposes Calibration rows yet -- see the
              restyle plan's Phase 4 notes. Placeholder rather than
              blocking this screen on a new endpoint. */}
          <DetailRow label="Calibration — dry" value="—" mono />
          <DetailRow label="Calibration — wet" value="—" mono />
        </div>
      </Card>

      <DeviceDetailControls device={device} unassignedPlants={unassignedPlants} />
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-text-primary [font:var(--text-body-m)]">
      <span>{label}</span>
      <span className={`text-text-muted ${mono ? "[font:var(--text-mono-m)]" : ""}`}>{value}</span>
    </div>
  );
}
