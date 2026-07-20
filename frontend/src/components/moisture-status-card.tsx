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
      <div className="flex flex-col items-center gap-2 rounded-m border border-dashed border-border-strong bg-surface-card px-6 py-12 text-center">
        <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
          Soil moisture
        </p>
        <p className="text-text-primary [font:var(--text-body-m)]">Unavailable</p>
        <p className="max-w-xs text-text-muted [font:var(--text-body-s)]">
          No reading has come in yet for this plant.
        </p>
      </div>
    );
  }

  const level = moistureLevel(reading.moisturePercent);
  const copy = MOISTURE_LEVEL_COPY[level];
  const stale = isReadingStale(reading, reportingIntervalSeconds);

  return (
    <div className="flex flex-col gap-4 rounded-m border border-border-default bg-surface-card p-6 shadow-card">
      <div className="flex flex-col gap-2.5">
        <span className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
          Soil moisture
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-text-primary [font:var(--text-display-m)]">
            {reading.moisturePercent.toFixed(0)}%
          </span>
          {/* Status color lives on the dot only -- text stays a neutral ink
              token, since Golden Pollen (warning) fails WCAG text contrast
              outright as text. */}
          <span className="flex items-center gap-1.5 uppercase tracking-[var(--tracking-label)] text-text-primary [font:var(--text-label)]">
            <span className={`h-1.5 w-1.5 rounded-full ${copy.dotClass}`} aria-hidden="true" />
            {copy.label}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-text-muted [font:var(--text-body-s)]">
        <span>Updated {formatRelativeTime(reading.recordedAt)}</span>
        {stale ? (
          <span className="rounded-pill bg-status-warning-bg px-2 py-0.5 uppercase tracking-[var(--tracking-label)] text-status-warning-fg [font:var(--text-label)]">
            Stale
          </span>
        ) : null}
      </div>
    </div>
  );
}
