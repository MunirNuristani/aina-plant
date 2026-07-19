"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisTime, formatDateTime } from "@/lib/format";
import { buildChartSeries, type ChartPoint } from "@/lib/moisture";
import type { CareEvent, SensorReading } from "@/lib/types";

type Range = "24h" | "7d";
type RangeBounds = Record<Range, { start: string; end: string }>;

const RANGES: Range[] = ["24h", "7d"];
const RANGE_LABEL: Record<Range, string> = { "24h": "24 hours", "7d": "7 days" };

const AXIS_TICK = { fill: "var(--color-ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" };

export function MoistureHistoryChart({
  readingsByRange,
  rangeBounds,
  careEvents,
  reportingIntervalSeconds,
}: {
  readingsByRange: Record<Range, SensorReading[]>;
  rangeBounds: RangeBounds;
  careEvents: CareEvent[];
  reportingIntervalSeconds: number;
}) {
  const [range, setRange] = useState<Range>("7d");
  const readings = readingsByRange[range];
  // buildChartSeries and its data (gaps, values) are untouched by anything
  // in this component — event markers are a purely additive overlay, never
  // folded into the sensor series itself.
  const series = useMemo(
    () => buildChartSeries(readings, reportingIntervalSeconds),
    [readings, reportingIntervalSeconds],
  );

  const bounds = rangeBounds[range];
  const boundsStart = new Date(bounds.start).getTime();
  const boundsEnd = new Date(bounds.end).getTime();

  // "The selected range" is this fixed 24h/7d window, not wherever actual
  // readings happen to start/end — a sparse or newly-registered device
  // shouldn't shrink the axis, and a watering event needs a valid x
  // position on the chart even if it falls outside the real reading data
  // (before the first reading, inside a gap, etc.).
  const ticks = useMemo(() => {
    const count = range === "24h" ? 4 : 5;
    return Array.from({ length: count }, (_, i) => boundsStart + ((boundsEnd - boundsStart) * i) / (count - 1));
  }, [boundsStart, boundsEnd, range]);

  // Events inside the selected range, oldest first to match the chart's
  // left-to-right reading direction (careEvents itself is newest-first).
  const visibleEvents = useMemo(
    () =>
      careEvents
        .filter((event) => {
          const t = new Date(event.occurredAt).getTime();
          return t >= boundsStart && t <= boundsEnd;
        })
        .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    [careEvents, boundsStart, boundsEnd],
  );

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
          <div
            className="h-64 w-full"
            role="img"
            aria-label={`Moisture percentage over the last ${RANGE_LABEL[range]}${
              visibleEvents.length > 0 ? `, with ${visibleEvents.length} watering event(s) marked` : ""
            }`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[boundsStart, boundsEnd]}
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
                {/* Watering events — a dashed terracotta line per the AINA
                    usage guide ("works well for watering events, alerts,
                    and timeline markers"), independent of the sensor series:
                    it renders at the event's real timestamp regardless of
                    whether a reading exists there, so it still shows up
                    inside a gap or outside the actual reading data. Dashed
                    (not the gridlines' solid hairline) deliberately reads as
                    a different layer — an annotation, not a grid. */}
                {visibleEvents.map((event) => (
                  <ReferenceLine
                    key={event.id}
                    x={new Date(event.occurredAt).getTime()}
                    stroke="var(--color-accent-warm)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    label={{ value: "\u{1F4A7}", position: "top", fontSize: 12 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* The real accessible channel for event details — reachable by
              reading the page normally, no hover/focus/pointer needed. The
              chart's ReferenceLines are a visual-only enhancement; SVG
              elements like these aren't keyboard-focusable in any
              lightweight way, so "keyboard accessible where practical"
              means here, not inside the chart canvas. */}
          {visibleEvents.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                Watering events in this range
              </p>
              <ul className="flex flex-col gap-1.5">
                {visibleEvents.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-accent-warm" aria-hidden="true" />
                    <span className="text-ink">{formatDateTime(event.occurredAt)}</span>
                    {event.amount !== null ? (
                      <span className="font-mono text-ink-muted">
                        {event.amount}
                        {event.unit ? ` ${event.unit}` : ""}
                      </span>
                    ) : null}
                    {event.notes ? <span className="text-ink-muted">&mdash; {event.notes}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
