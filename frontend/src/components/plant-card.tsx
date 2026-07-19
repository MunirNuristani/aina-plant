import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import type { Plant, SensorReading } from "@/lib/types";

export function PlantCard({
  plant,
  latestReading,
}: {
  plant: Plant;
  latestReading: SensorReading | null;
}) {
  return (
    <Link
      href={`/plants/${plant.id}`}
      className="group flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-primary"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg tracking-tight text-ink group-hover:text-primary">
          {plant.name}
        </h2>
        {plant.location ? (
          <p className="text-sm text-ink-muted">{plant.location}</p>
        ) : null}
      </div>

      {latestReading ? (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <p className="font-mono text-sm text-ink">
            {latestReading.moisturePercent.toFixed(0)}% moisture
            <span className="text-ink-muted">
              {" "}
              &middot; updated {formatRelativeTime(latestReading.recordedAt)}
            </span>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full border border-line" aria-hidden="true" />
          <p className="font-mono text-sm text-ink-muted">No readings yet</p>
        </div>
      )}
    </Link>
  );
}
