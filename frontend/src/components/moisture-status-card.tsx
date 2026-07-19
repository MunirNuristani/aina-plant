import { formatRelativeTime } from "@/lib/format";
import { isReadingStale, moistureLevel, MOISTURE_LEVEL_COPY } from "@/lib/moisture";
import type { SensorReading } from "@/lib/types";

export function MoistureStatusCard({
  reading,
  reportingIntervalSeconds,
}: {
  reading: SensorReading | null;
  reportingIntervalSeconds: number;
}) {
  if (!reading) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Moisture</p>
        <p className="text-ink">Unavailable</p>
        <p className="max-w-xs text-sm text-ink-muted">No reading has come in yet for this plant.</p>
      </div>
    );
  }

  const level = moistureLevel(reading.moisturePercent);
  const copy = MOISTURE_LEVEL_COPY[level];
  const stale = isReadingStale(reading, reportingIntervalSeconds);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-5xl tracking-tight text-ink">
          {reading.moisturePercent.toFixed(0)}%
        </span>
        <span className={`flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest ${copy.textClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${copy.dotClass}`} aria-hidden="true" />
          {copy.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>Updated {formatRelativeTime(reading.recordedAt)}</span>
        {stale ? (
          <span className="rounded-full bg-warning/10 px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-warning">
            Stale
          </span>
        ) : null}
      </div>
    </div>
  );
}
