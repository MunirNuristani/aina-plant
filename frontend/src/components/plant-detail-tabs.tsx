"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { MoistureStatusCard } from "@/components/moisture-status-card";
import { DeviceStatusBadge } from "@/components/device-status-badge";
import { TrendSummary } from "@/components/trend-summary";
import { MoistureHistoryChart } from "@/components/moisture-history-chart";
import { TechnicalDetails } from "@/components/technical-details";
import { CareEventList } from "@/components/care-event-list";
import { LogWateringForm } from "@/components/log-watering-form";
import type { CareEvent, DryingRateAnalysis, MoistureTrendResult, Plant, SensorReading } from "@/lib/types";

type Range = "24h" | "7d";
type DetailTab = "overview" | "history" | "care";

// Owns the Overview/History/Care sub-tab state (matches the mockup's
// detailTab) -- the page itself stays a Server Component that fetches
// everything up front and passes it down here.
export function PlantDetailTabs({
  plant,
  plantId,
  latestReading,
  reportingIntervalSeconds,
  trend,
  dryingRate,
  careEvents,
  readingsByRange,
  rangeBounds,
}: {
  plant: Plant;
  plantId: string;
  latestReading: SensorReading | null;
  reportingIntervalSeconds: number;
  trend: MoistureTrendResult;
  dryingRate: DryingRateAnalysis;
  careEvents: CareEvent[];
  readingsByRange: Record<Range, SensorReading[]>;
  rangeBounds: Record<Range, { start: string; end: string }>;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const device = plant.devices[0];

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as DetailTab)}
        items={[
          { value: "overview", label: "Overview" },
          { value: "history", label: "History" },
          { value: "care", label: "Care" },
        ]}
      />

      {tab === "overview" ? (
        <div className="flex flex-col gap-4">
          <MoistureStatusCard reading={latestReading} reportingIntervalSeconds={reportingIntervalSeconds} />

          <Card>
            <DeviceStatusBadge device={device} />
          </Card>

          <TrendSummary trend={trend} dryingRate={dryingRate} />

          {latestReading ? <TechnicalDetails reading={latestReading} /> : null}
        </div>
      ) : null}

      {tab === "history" ? (
        <MoistureHistoryChart
          readingsByRange={readingsByRange}
          rangeBounds={rangeBounds}
          careEvents={careEvents}
          reportingIntervalSeconds={reportingIntervalSeconds}
        />
      ) : null}

      {tab === "care" ? (
        <div className="flex flex-col gap-4">
          <LogWateringForm plantId={plantId} />
          <CareEventList plantId={plantId} careEvents={careEvents} />
        </div>
      ) : null}
    </div>
  );
}
