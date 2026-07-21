import Link from "next/link";
import { Flower, Flower2, Lightbulb, Palmtree, Sprout, Trees } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlantCard } from "@/components/plant-card";
import { getLatestReading, getPlants } from "@/lib/plants";
import { getRandomPlantFact, type PlantFact } from "@/lib/plant-facts";
import { getSessionEmail } from "@/lib/session";
import type { Plant, SensorReading } from "@/lib/types";

const PLANT_TYPES: { icon: ComponentType<{ size?: number; className?: string }>; label: string }[] = [
  { icon: Flower2, label: "Flowering" },
  { icon: Sprout, label: "Foliage" },
  { icon: Trees, label: "Succulents" },
  { icon: Sprout, label: "Herbs" },
  { icon: Flower, label: "Orchids" },
  { icon: Palmtree, label: "Tropicals" },
];

// Signed-in visitors see their own plants (or, for a brand-new zero-plant
// account, the original onboarding); signed-out visitors get a random
// Perenual plant fact and a nudge to log in instead (see lib/plant-facts.ts
// for where that fact comes from).
export default async function WelcomePage() {
  const email = await getSessionEmail();

  if (email) {
    const plants = await getPlants();

    if (plants.length === 0) {
      return <NewAccountOnboarding />;
    }

    const latestReadings = await Promise.all(plants.map((plant) => getLatestReading(plant.id)));
    return <YourPlants plants={plants} latestReadings={latestReadings} />;
  }

  const fact = await getRandomPlantFact();
  return <SignedOutFact fact={fact} />;
}

function YourPlants({
  plants,
  latestReadings,
}: {
  plants: Plant[];
  latestReadings: (SensorReading | null)[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-8 pb-4">
      <div className="flex flex-col gap-1">
        <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
          Welcome back
        </p>
        <h1 className="text-text-primary [font:var(--text-display-m)]">
          {plants.length} {plants.length === 1 ? "plant" : "plants"} under watch
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {plants.map((plant, index) => (
          <PlantCard key={plant.id} plant={plant} latestReading={latestReadings[index]} />
        ))}
      </div>

      <Link href="/plants">
        <Button variant="secondary" className="w-full">
          View all plants
        </Button>
      </Link>
    </div>
  );
}

function NewAccountOnboarding() {
  const PLANT_FACT =
    "Most houseplants prefer to dry out slightly between waterings — soggy soil is a more common killer than a dry spell.";

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-8 pb-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-semibold tracking-tight [font:var(--text-heading-l)]">AINA</span>
        <p className="mt-2 text-text-primary [font:var(--text-heading-m)]">Know your plants better</p>
        <p className="max-w-70 text-text-secondary [font:var(--text-body-m)]">
          Pair a sensor and get a calm, steady read on how each plant is doing.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {PLANT_TYPES.map((type, index) => {
          const Icon = type.icon;
          return (
            <div key={`${type.label}-${index}`} className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-moss-tint">
                <Icon size={26} className="text-action-primary" />
              </div>
              <span className="text-center text-text-secondary [font:var(--text-body-s)]">{type.label}</span>
            </div>
          );
        })}
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <Lightbulb size={20} className="mt-0.5 shrink-0 text-action-primary" />
          <div className="flex flex-col gap-0.5">
            <span className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
              Plant fact
            </span>
            <span className="text-text-primary [font:var(--text-body-m)]">{PLANT_FACT}</span>
          </div>
        </div>
      </Card>

      <div className="flex-1" />

      <Link href="/plants/new">
        <Button variant="primary" className="w-full">
          Get started
        </Button>
      </Link>
    </div>
  );
}

function SignedOutFact({ fact }: { fact: PlantFact }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-8 pb-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-semibold tracking-tight [font:var(--text-heading-l)]">AINA</span>
        <p className="mt-2 text-text-primary [font:var(--text-heading-m)]">Know your plants better</p>
        <p className="max-w-70 text-text-secondary [font:var(--text-body-m)]">
          Pair a sensor and get a calm, steady read on how each plant is doing.
        </p>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        {fact.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote, pre-signed URL from a third party; not worth a next.config remotePatterns entry for a decorative fact image
          <img src={fact.imageUrl} alt={fact.commonName} className="h-40 w-full object-cover" />
        ) : null}
        <div className="flex items-start gap-3 p-5">
          <Lightbulb size={20} className="mt-0.5 shrink-0 text-action-primary" />
          <div className="flex flex-col gap-0.5">
            <span className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
              Plant fact &middot; {fact.commonName}
              {fact.scientificName ? (
                <span className="italic normal-case"> ({fact.scientificName})</span>
              ) : null}
            </span>
            <span className="text-text-primary [font:var(--text-body-m)]">{fact.description}</span>
          </div>
        </div>
      </Card>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-3">
        <Link href="/login" className="w-full">
          <Button variant="primary" className="w-full">
            Log in to track your plants
          </Button>
        </Link>
        <p className="text-text-muted [font:var(--text-body-s)]">
          New here?{" "}
          <Link href="/signup" className="text-text-link hover:text-text-link-hover">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
