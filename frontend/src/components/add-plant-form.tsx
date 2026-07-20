"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createPlantAction } from "@/lib/actions/plants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const POT_SIZE_OPTIONS = ["10 cm", "12 cm", "15 cm", "20 cm", "25 cm", "30 cm+"].map((v) => ({
  value: v,
  label: v,
}));
const SOIL_TYPE_OPTIONS = ["Potting mix", "Cactus / succulent mix", "Orchid mix", "Custom blend"].map((v) => ({
  value: v,
  label: v,
}));

export function AddPlantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [commonName, setCommonName] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [location, setLocation] = useState("");
  const [potSize, setPotSize] = useState(POT_SIZE_OPTIONS[2].value);
  const [soilType, setSoilType] = useState(SOIL_TYPE_OPTIONS[0].value);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (name.trim() === "") {
      setFieldErrors({ name: "Name cannot be blank" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPlantAction({
        name: name.trim(),
        commonName: commonName.trim() || undefined,
        scientificName: scientificName.trim() || undefined,
        location: location.trim() || undefined,
        potSize,
        soilType,
        notes: notes.trim() || undefined,
      });

      if (result.ok) {
        // Matches the mockup's onContinueAddPlant: land on the pairing
        // flow next, pre-targeted at the plant just created.
        router.push(`/devices/pair?plantId=${result.plant.id}`);
      } else {
        setFieldErrors(result.fieldErrors);
        if (result.formError) {
          setFormError(result.formError);
        }
        setSubmitting(false);
      }
    } catch {
      setFormError("Something went wrong creating this plant.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input id="name" label="Name" placeholder="e.g. Basil" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} />
      <Input
        id="commonName"
        label="Common name"
        placeholder="Optional"
        value={commonName}
        onChange={(e) => setCommonName(e.target.value)}
        error={fieldErrors.commonName}
      />
      <Input
        id="scientificName"
        label="Scientific name"
        placeholder="Optional"
        value={scientificName}
        onChange={(e) => setScientificName(e.target.value)}
        error={fieldErrors.scientificName}
      />
      <Input
        id="location"
        label="Location"
        placeholder="e.g. Kitchen window"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        error={fieldErrors.location}
      />
      <Select id="potSize" label="Pot size" value={potSize} onChange={(e) => setPotSize(e.target.value)} options={POT_SIZE_OPTIONS} />
      <Select
        id="soilType"
        label="Soil type"
        value={soilType}
        onChange={(e) => setSoilType(e.target.value)}
        options={SOIL_TYPE_OPTIONS}
      />
      <Input id="notes" label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {formError ? (
        <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={submitting || name.trim() === ""}>
        {submitting ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}
