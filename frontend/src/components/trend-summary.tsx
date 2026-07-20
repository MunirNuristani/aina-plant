import { formatDateTime } from "@/lib/format";
import type { DryingPeriodResult, DryingRateAnalysis, MoistureTrendResult } from "@/lib/types";
import { Card } from "@/components/ui/card";

// Matches moisture-trend-service.ts's DEFAULT_ANALYSIS_WINDOW_HOURS — the
// frontend never passes a custom windowHours, so this is always the actual
// window the API used. Unlike the drying-rate period below, the trend
// response doesn't echo its own window back, so this has to be asserted
// rather than read from the response.
const TREND_WINDOW_HOURS = 24;

const TREND_SENTENCE: Record<"INCREASING" | "DECREASING" | "STABLE", string> = {
  INCREASING: "Soil moisture has been increasing",
  DECREASING: "Soil moisture has been decreasing",
  STABLE: "Soil moisture has been holding steady",
};

function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

export function TrendSummary({
  trend,
  dryingRate,
}: {
  trend: MoistureTrendResult;
  dryingRate: DryingRateAnalysis;
}) {
  // The most recent watering-bounded period — "since the last watering" is
  // the more useful fact than a rate blended across several waterings.
  const latestPeriod: DryingPeriodResult | undefined = dryingRate.periods.at(-1);
  const sinceLastWatering = dryingRate.periods.length > 1;
  const dryingRateDays = daysBetween(dryingRate.analysisPeriodStart, dryingRate.analysisPeriodEnd);

  return (
    <Card className="flex flex-col gap-4">
      <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
        Trend summary
      </p>

      {/* Interpretation — plain language. Deliberately hedged: INCREASING/
          DECREASING/STABLE are stated as fact (the underlying comparison
          really did happen), but the drying rate always gets an
          "approximately"/"roughly", and LOW_CONFIDENCE gets an explicit
          caveat — never more certainty than the data supports. */}
      <div className="flex flex-col gap-1.5">
        {trend.direction === "INSUFFICIENT_DATA" ? (
          <p className="text-text-primary [font:var(--text-body-m)]">
            Not enough recent data to determine a trend
            {trend.readingCount > 0 ? ` (only ${trend.readingCount} reading(s) in this window)` : ""}.
          </p>
        ) : (
          <p className="text-text-primary [font:var(--text-body-m)]">
            {TREND_SENTENCE[trend.direction]} over the last {TREND_WINDOW_HOURS} hours.
          </p>
        )}

        <DryingRateSentence period={latestPeriod} sinceLastWatering={sinceLastWatering} periodDays={dryingRateDays} />
      </div>

      {/* Measured facts — the actual numbers the sentences above are based
          on, kept visually distinct from the interpretation above it. */}
      <div className="flex flex-col gap-1 border-t border-border-default pt-3">
        <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
          Measured
        </p>
        <p className="text-text-muted [font:var(--text-mono-s)]">Trend window: last {TREND_WINDOW_HOURS} hours</p>
        {trend.earliest && trend.latest ? (
          <p className="text-text-primary [font:var(--text-mono-s)]">
            {trend.earliest.moisturePercent.toFixed(0)}% ({formatDateTime(trend.earliest.recordedAt)})
            {" → "}
            {trend.latest.moisturePercent.toFixed(0)}% ({formatDateTime(trend.latest.recordedAt)})
          </p>
        ) : null}
        <p className="text-text-muted [font:var(--text-mono-s)]">
          Drying-rate window: last {dryingRateDays} day{dryingRateDays === 1 ? "" : "s"}
          {sinceLastWatering ? ", most recent period since last watering" : ""}
        </p>
        {latestPeriod ? (
          <p className="text-text-muted [font:var(--text-mono-s)]">
            {latestPeriod.readingCount} reading(s) in that period
            {latestPeriod.hasGap ? " — includes a data gap" : ""}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function DryingRateSentence({
  period,
  sinceLastWatering,
  periodDays,
}: {
  period: DryingPeriodResult | undefined;
  sinceLastWatering: boolean;
  periodDays: number;
}) {
  if (!period) {
    return null;
  }

  const scope = sinceLastWatering ? "since the last watering" : `over the last ${periodDays} days`;
  const textClass = "text-text-primary [font:var(--text-body-m)]";

  switch (period.state) {
    case "VALID":
      return (
        <p className={textClass}>
          Drying at approximately {period.ratePercentPerHour?.toFixed(1)}% per hour {scope}.
        </p>
      );
    case "LOW_CONFIDENCE":
      return (
        <p className={textClass}>
          Drying at roughly {period.ratePercentPerHour?.toFixed(1)}% per hour {scope} — a gap in the
          readings during this period makes this estimate less certain.
        </p>
      );
    case "NOT_DRYING":
      return <p className={textClass}>Not currently drying {scope} — moisture has been rising or steady.</p>;
    case "INSUFFICIENT_DATA":
      return <p className={textClass}>Not enough data to estimate a drying rate {scope}.</p>;
  }
}
