import Link from "next/link";
import { Flower, Flower2, Lightbulb, Palmtree, Sprout, Trees } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PLANT_TYPES: { icon: ComponentType<{ size?: number; className?: string }>; label: string }[] = [
  { icon: Flower2, label: "Flowering" },
  { icon: Sprout, label: "Foliage" },
  { icon: Trees, label: "Succulents" },
  { icon: Sprout, label: "Herbs" },
  { icon: Flower, label: "Orchids" },
  { icon: Palmtree, label: "Tropicals" },
];

const PLANT_FACT =
  "Most houseplants prefer to dry out slightly between waterings — soggy soil is a more common killer than a dry spell.";

// Shown once, right after signup, when a brand-new user has zero plants
// (signupAction routes here directly rather than to /plants -- see
// signup-form.tsx). Logging in never lands here, only signing up does.
export default function WelcomePage() {
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
