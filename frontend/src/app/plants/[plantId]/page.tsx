import Link from "next/link";
import { notFound } from "next/navigation";
import { MoistureStatusCard } from "@/components/moisture-status-card";
import { TechnicalDetails } from "@/components/technical-details";
import { DEFAULT_REPORTING_INTERVAL_SECONDS } from "@/lib/moisture";
import { getLatestReading, getPlant } from "@/lib/plants";

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

  const latestReading = await getLatestReading(plantId);
  const reportingIntervalSeconds =
    plant.devices[0]?.reportingIntervalSeconds ?? DEFAULT_REPORTING_INTERVAL_SECONDS;

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
      </div>

      <MoistureStatusCard reading={latestReading} reportingIntervalSeconds={reportingIntervalSeconds} />

      {latestReading ? <TechnicalDetails reading={latestReading} /> : null}
    </div>
  );
}
