"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisTime, formatDateTime } from "@/lib/format";
import { buildChartSeries, type ChartPoint } from "@/lib/moisture";
import type { SensorReading } from "@/lib/types";

type Range = "24h" | "7d";

const RANGES: Range[] = ["24h", "7d"];
const RANGE_LABEL: Record<Range, string> = { "24h": "24 hours", "7d": "7 days" };

const AXIS_TICK = { fill: "var(--color-ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" };

export function MoistureHistoryChart({
  readingsByRange,
  reportingIntervalSeconds,
}: {
  readingsByRange: Record<Range, SensorReading[]>;
  reportingIntervalSeconds: number;
}) {
  const [range, setRange] = useState<Range>("7d");
  const readings = readingsByRange[range];
  const series = useMemo(
    () => buildChartSeries(readings, reportingIntervalSeconds),
    [readings, reportingIntervalSeconds],
  );
  // Recharts' auto tick generation on a numeric time domain doesn't respect
  // tickCount the way it does on a real d3 time scale — it was rendering 13+
  // overlapping same-day labels. Computing exact, evenly-spaced tick values
  // ourselves and handing them to XAxis via `ticks` sidesteps that entirely.
  const ticks = useMemo(() => {
    if (series.length === 0) return [];
    const first = series[0].time;
    const last = series[series.length - 1].time;
    // Mobile-first: chosen so labels stay non-overlapping down to a ~340px
    // plot width (a card on a 390px phone), not just on a full desktop chart.
    const count = range === "24h" ? 4 : 5;
    if (first === last) return [first];
    return Array.from({ length: count }, (_, i) => first + ((last - first) * i) / (count - 1));
  }, [series, range]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Moisture history</p>
        <div className="flex gap-1 rounded-md border border-line p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded px-2.5 py-1 font-mono text-xs uppercase tracking-widest transition-colors ${
                range === r ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {readings.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-line px-6 py-12 text-center">
          <p className="text-ink">No data in this range</p>
          <p className="max-w-xs text-sm text-ink-muted">
            No readings were recorded in the last {RANGE_LABEL[range]}.
          </p>
        </div>
      ) : (
        <>
          <div className="h-64 w-full" role="img" aria-label={`Moisture percentage over the last ${RANGE_LABEL[range]}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  padding={{ left: 12, right: 12 }}
                  tickFormatter={(t: number) => formatAxisTime(t, range)}
                  ticks={ticks}
                  tick={AXIS_TICK}
                  stroke="var(--color-line)"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={AXIS_TICK}
                  stroke="var(--color-line)"
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "var(--color-primary)", strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                <Area
                  dataKey="moisturePercent"
                  stroke="none"
                  fill="var(--color-primary)"
                  fillOpacity={0.1}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="moisturePercent"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  // Signal Lime fails mark contrast against the card surface
                  // on its own (~1.6:1, below the 3:1 floor — validated via
                  // the dataviz skill's validate_palette.js contrast()) — a
                  // primary-color ring keeps the dot clearly visible while
                  // still using accent for the fill, per the AINA usage
                  // guide's "sparingly for ... chart points."
                  activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-primary)", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <MoistureHistoryTable readings={readings} />
        </>
      )}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.moisturePercent === null) {
    return null;
  }

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-sm">
      <p className="font-display text-lg text-ink">{point.moisturePercent.toFixed(0)}%</p>
      <p className="font-mono text-xs text-ink-muted">{formatDateTime(new Date(point.time).toISOString())}</p>
    </div>
  );
}

// The WCAG-clean twin of the chart above — every value the chart plots is
// also reachable here, without hovering.
function MoistureHistoryTable({ readings }: { readings: SensorReading[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-ink-muted group-open:text-ink">
        View as table
      </summary>
      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-line">
        <table className="w-full font-mono text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line text-left text-ink-muted">
              <th scope="col" className="px-3 py-2 font-normal">
                Recorded at
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Moisture
              </th>
            </tr>
          </thead>
          <tbody>
            {[...readings].reverse().map((reading) => (
              <tr key={reading.id} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 text-ink">{formatDateTime(reading.recordedAt)}</td>
                <td className="px-3 py-1.5 tabular-nums text-ink">{reading.moisturePercent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
