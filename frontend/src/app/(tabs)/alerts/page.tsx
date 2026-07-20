import { CircleAlert, Clock, WifiOff } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { computeDeviceStatus } from "@/lib/device-status";
import { moistureLevel } from "@/lib/moisture";
import { getLatestReading, getPlants } from "@/lib/plants";

type AlertTone = "critical" | "warning" | "info";

type Alert = {
  key: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: AlertTone;
  tag: string;
  plant: string;
  text: string;
};

// Entirely derived from data the API already returns -- no backend change
// needed. Reuses the same computeDeviceStatus()/moistureLevel() helpers
// already relied on elsewhere (PlantCard, plant detail), so "critical"
// here means the exact same thing it means on those screens.
export default async function AlertsPage() {
  const plants = await getPlants();
  const latestReadings = await Promise.all(plants.map((plant) => getLatestReading(plant.id)));

  const alerts: Alert[] = [];

  plants.forEach((plant, index) => {
    const reading = latestReadings[index];
    const device = plant.devices[0];
    const deviceStatus = computeDeviceStatus(device);

    if (reading && moistureLevel(reading.moisturePercent) === "needs-water") {
      alerts.push({
        key: `${plant.id}-moisture`,
        icon: CircleAlert,
        tone: "critical",
        tag: "Critical",
        plant: plant.name,
        text: `${plant.name} is critically dry — water within a day.`,
      });
    }
    if (deviceStatus === "offline") {
      alerts.push({
        key: `${plant.id}-offline`,
        icon: WifiOff,
        tone: "warning",
        tag: "Offline",
        plant: plant.name,
        text: `Signal lost for ${device?.identifier}. Check the hub's Wi-Fi.`,
      });
    }
    if (deviceStatus === "delayed") {
      alerts.push({
        key: `${plant.id}-delayed`,
        icon: Clock,
        tone: "info",
        tag: "Delayed",
        plant: plant.name,
        text: `${device?.identifier} hasn't reported in longer than expected.`,
      });
    }
  });

  return (
    <div className="flex w-full flex-1 flex-col gap-3 px-4 pt-6 pb-4">
      <h1 className="mb-1 text-text-primary [font:var(--text-display-m)]">Alerts</h1>

      {alerts.length === 0 ? (
        <p className="py-6 text-center text-text-muted [font:var(--text-body-m)]">No alerts right now.</p>
      ) : (
        alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <Card key={alert.key}>
              <div className="flex items-start gap-3">
                <Icon size={20} className="mt-0.5 shrink-0 text-text-secondary" />
                <div className="flex-1">
                  <p className="text-text-primary [font:var(--text-body-m)]">{alert.text}</p>
                  <p className="mt-0.5 text-text-muted [font:var(--text-body-s)]">{alert.plant}</p>
                </div>
                <Badge tone={alert.tone}>{alert.tag}</Badge>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
