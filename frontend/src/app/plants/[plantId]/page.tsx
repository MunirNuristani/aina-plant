import Link from "next/link";
import { notFound } from "next/navigation";
import { CareEventList } from "@/components/care-event-list";
import { DeviceStatusBadge } from "@/components/device-status-badge";
import { LogWateringForm } from "@/components/log-watering-form";
import { MoistureHistoryChart } from "@/components/moisture-history-chart";
import { MoistureStatusCard } from "@/components/moisture-status-card";
import { TechnicalDetails } from "@/components/technical-details";
import { TrendSummary } from "@/components/trend-summary";
import { DEFAULT_REPORTING_INTERVAL_SECONDS } from "@/lib/moisture";
import {
  getCareEvents,
  getDryingRate,
  getLatestReading,
  getMoistureTrend,
  getPlant,
  getReadingHistory,
} from "@/lib/plants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function PlantDashboardPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  const plant = await getPlant(plantId);

  if (!plant) {
    notFound();
  }

  const reportingIntervalSeconds =
    plant.devices[0]?.reportingIntervalSeconds ?? DEFAULT_REPORTING_INTERVAL_SECONDS;

  // Plant existence is already confirmed above, so these can run in
  // parallel — none of them has its own not-found path to race against.
  const now = new Date();
  const start24h = new Date(now.getTime() - MS_PER_DAY);
  const start7d = new Date(now.getTime() - 7 * MS_PER_DAY);

  const [latestReading, readings24h, readings7d, careEvents, trend, dryingRate] = await Promise.all([
    getLatestReading(plantId),
    getReadingHistory(plantId, { start: start24h, end: now }),
    getReadingHistory(plantId, { start: start7d, end: now }),
    getCareEvents(plantId),
    getMoistureTrend(plantId),
    getDryingRate(plantId),
  ]);

  // The chart's x-axis domain, not just the reading fetch — see
  // MoistureHistoryChart's comment on why "the selected range" is this
  // fixed window, not wherever the actual readings happen to start/end.
  const rangeBounds = {
    "24h": { start: start24h.toISOString(), end: now.toISOString() },
    "7d": { start: start7d.toISOString(), end: now.toISOString() },
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-1">
        <Link
          href="/plants"
          className="font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-primary"
        >
          &larr; all plants
        </Link>
        <h1 className="font-display text-3xl tracking-tight text-ink">{plant.name}</h1>
        {plant.location ? <p className="text-ink-muted">{plant.location}</p> : null}
        <div className="mt-1">
          <DeviceStatusBadge device={plant.devices[0]} />
        </div>
      </div>

      <MoistureStatusCard reading={latestReading} reportingIntervalSeconds={reportingIntervalSeconds} />

      <TrendSummary trend={trend} dryingRate={dryingRate} />

      <LogWateringForm plantId={plantId} />

      <CareEventList plantId={plantId} careEvents={careEvents} />

      <MoistureHistoryChart
        readingsByRange={{ "24h": readings24h, "7d": readings7d }}
        rangeBounds={rangeBounds}
        careEvents={careEvents}
        reportingIntervalSeconds={reportingIntervalSeconds}
      />

      {latestReading ? <TechnicalDetails reading={latestReading} /> : null}
    </div>
  );
}
