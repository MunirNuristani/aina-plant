import Link from "next/link";
import { Leaf, Plus } from "lucide-react";
import { PlantCard } from "@/components/plant-card";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { getLatestReading, getPlants } from "@/lib/plants";

export default async function PlantsPage() {
  const plants = await getPlants();
  const latestReadings = await Promise.all(
    plants.map((plant) => getLatestReading(plant.id)),
  );

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <div className="mb-1 flex items-end justify-between">
        <div>
          <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
            Good morning
          </p>
          <h1 className="text-text-primary [font:var(--text-display-m)]">Your plants</h1>
        </div>
        <Link href="/plants/new">
          <IconButton icon={<Plus size={18} />} label="Add plant" variant="primary" />
        </Link>
      </div>

      {plants.length === 0 ? (
        <div className="flex flex-col items-center gap-3.5 py-14 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-moss-tint">
            <Leaf size={30} className="text-action-primary" />
          </div>
          <p className="text-text-primary [font:var(--text-heading-m)]">No plants yet</p>
          <p className="max-w-[260px] text-text-muted [font:var(--text-body-m)]">
            Add your first plant to start tracking its soil moisture.
          </p>
          <Link href="/plants/new">
            <Button variant="primary">Add a plant</Button>
          </Link>
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
