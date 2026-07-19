import { PlantCard } from "@/components/plant-card";
import { getLatestReading, getPlants } from "@/lib/plants";

export default async function PlantsPage() {
  const plants = await getPlants();
  const latestReadings = await Promise.all(
    plants.map((plant) => getLatestReading(plant.id)),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl tracking-tight text-ink">Your plants</h1>
        <p className="text-ink-muted">Select a plant to see its dashboard.</p>
      </div>

      {plants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-6 py-16 text-center">
          <p className="text-ink">No plants yet</p>
          <p className="max-w-sm text-sm text-ink-muted">
            Register a device and assign it to a plant to see it show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plants.map((plant, index) => (
            <PlantCard key={plant.id} plant={plant} latestReading={latestReadings[index]} />
          ))}
        </div>
      )}
    </div>
  );
}
