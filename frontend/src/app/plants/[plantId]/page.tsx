import { notFound } from "next/navigation";
import { BackHeader } from "@/components/back-header";
import { PlantDetailTabs } from "@/components/plant-detail-tabs";
import { StatusPill } from "@/components/ui/status-pill";
import { DEFAULT_REPORTING_INTERVAL_SECONDS, moistureLevel, MOISTURE_LEVEL_TO_PILL_STATUS } from "@/lib/moisture";
import {
  getCareEvents,
  getDryingRate,
  getLatestReading,
  getMoistureTrend,
  getPlant,
  getReadingHistory,
} from "@/lib/plants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// This page lives outside both the (marketing) and (tabs) route groups --
// no wordmark header, no bottom tab bar, matching the mockup's
// isDetailScreen treatment (a back button + title row instead).
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <BackHeader
        backHref="/plants"
        title={plant.name}
        subtitle={[plant.location, plant.devices[0]?.identifier].filter(Boolean).join(" · ") || undefined}
        trailing={
          latestReading ? <StatusPill status={MOISTURE_LEVEL_TO_PILL_STATUS[moistureLevel(latestReading.moisturePercent)]} /> : null
        }
      />

      <PlantDetailTabs
        plant={plant}
        plantId={plantId}
        latestReading={latestReading}
        reportingIntervalSeconds={reportingIntervalSeconds}
        trend={trend}
        dryingRate={dryingRate}
        careEvents={careEvents}
        readingsByRange={{ "24h": readings24h, "7d": readings7d }}
        rangeBounds={rangeBounds}
      />
    </div>
  );
}
