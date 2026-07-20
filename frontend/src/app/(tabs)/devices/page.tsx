import Link from "next/link";
import { Cpu, Plus } from "lucide-react";
import { DeviceRow } from "@/components/device-row";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { getDevices } from "@/lib/devices";

export default async function DevicesPage() {
  const devices = await getDevices();

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <div className="mb-1 flex items-end justify-between">
        <h1 className="text-text-primary [font:var(--text-display-m)]">Devices</h1>
        <Link href="/devices/pair">
          <IconButton icon={<Plus size={18} />} label="Add device" variant="primary" />
        </Link>
      </div>

      {devices.length === 0 ? (
        <div className="flex flex-col items-center gap-3.5 py-14 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-moss-tint">
            <Cpu size={30} className="text-action-primary" />
          </div>
          <p className="text-text-primary [font:var(--text-heading-m)]">No devices paired</p>
          <p className="max-w-[260px] text-text-muted [font:var(--text-body-m)]">
            Devices you pair will appear here.
          </p>
          <Link href="/devices/pair">
            <Button variant="primary">Add a device</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {devices.map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
