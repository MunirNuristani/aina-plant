"use client";

type SensorStatTrend = "up" | "down" | "flat";

// Ported from components/data/SensorStat.jsx.
export function SensorStat({
  label,
  value,
  unit,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: SensorStatTrend;
}) {
  const trendColor =
    trend === "up" ? "text-status-healthy-fg" : trend === "down" ? "text-critical" : "text-text-muted";
  const trendGlyph = trend === "up" ? "↑" : trend === "down" ? "↓" : "";

  return (
    <div className="flex flex-col gap-1">
      <span className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-text-primary [font:var(--text-mono-l)]">{value}</span>
        {unit ? <span className="text-text-muted [font:var(--text-body-s)]">{unit}</span> : null}
        {trend ? <span className={`[font:var(--text-body-s)] ${trendColor}`}>{trendGlyph}</span> : null}
      </span>
    </div>
  );
}
