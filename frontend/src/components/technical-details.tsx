import { formatDateTime } from "@/lib/format";
import type { SensorReading } from "@/lib/types";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-start sm:gap-1">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

export function TechnicalDetails({ reading }: { reading: SensorReading }) {
  return (
    <details className="group rounded-lg border border-line bg-surface px-4 py-3">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-ink-muted group-open:text-ink">
        Technical details
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 font-mono text-xs text-ink sm:grid-cols-2">
        <DetailRow label="Raw moisture" value={String(reading.rawMoisture)} />
        <DetailRow label="Moisture %" value={`${reading.moisturePercent.toFixed(2)}%`} />
        <DetailRow label="Recorded at" value={formatDateTime(reading.recordedAt)} />
        <DetailRow label="Received at" value={formatDateTime(reading.receivedAt)} />
        <DetailRow label="Device ID" value={reading.deviceId} />
        <DetailRow label="Firmware" value={reading.firmwareVersion ?? "—"} />
        <DetailRow label="Wi-Fi RSSI" value={reading.wifiRssi !== null ? `${reading.wifiRssi} dBm` : "—"} />
      </dl>
    </details>
  );
}
