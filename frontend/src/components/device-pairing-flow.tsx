"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Check, Cpu } from "lucide-react";
import { assignDeviceAction, registerDeviceAction } from "@/lib/actions/devices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "form" | "done";

// Adapted from the mockup's idle/scanning/found/done BLE-style pairing
// flow, which has no real backend equivalent -- there's no hardware scan
// to perform. Real registration is: the identifier printed on the
// physical unit + a name -> POST /api/v1/devices -> a one-time credential
// the device's own setup screen needs. Keeps the mockup's step-count/
// polish feel without pretending to discover hardware.
export function DevicePairingFlow({ plantId }: { plantId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [credential, setCredential] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (identifier.trim() === "") {
      setFieldErrors({ identifier: "Enter the identifier printed on the device." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerDeviceAction({
        name: name.trim() || identifier.trim(),
        identifier: identifier.trim(),
      });

      if (result.ok) {
        setCredential(result.credential);

        if (plantId) {
          const assignResult = await assignDeviceAction(result.device.id, plantId);
          if (!assignResult.ok) {
            setFormError(assignResult.error);
          }
        }

        setStep("done");
      } else {
        setFieldErrors(result.fieldErrors);
        if (result.formError) {
          setFormError(result.formError);
        }
      }
    } catch {
      setFormError("Something went wrong registering this device.");
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    router.push(plantId ? `/plants/${plantId}` : "/devices");
    router.refresh();
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-status-healthy-bg">
          <Check size={40} className="text-status-healthy-fg" />
        </div>
        <p className="text-text-primary [font:var(--text-heading-m)]">Device registered</p>

        <div className="flex w-full flex-col gap-1.5 rounded-m border border-border-default bg-surface-card p-4 text-left">
          <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
            One-time credential
          </p>
          <p className="break-all text-text-primary [font:var(--text-mono-m)]">{credential}</p>
          <p className="text-text-muted [font:var(--text-body-s)]">
            Enter this into the device&rsquo;s own setup screen now — it can&rsquo;t be shown again. If you lose it,
            rotate it from the device&rsquo;s detail page.
          </p>
        </div>

        {formError ? (
          <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
            {formError}
          </p>
        ) : null}

        <Button variant="primary" onClick={finish}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-moss-tint">
          <Cpu size={40} className="text-action-primary" />
        </div>
        <p className="text-text-secondary [font:var(--text-body-m)]">
          Enter the identifier printed on your AINA sensor to register it.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          id="identifier"
          label="Device identifier"
          placeholder="e.g. esp32-balcony-01"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          error={fieldErrors.identifier}
        />
        <Input
          id="name"
          label="Name (optional)"
          placeholder="e.g. Balcony sensor"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
        />

        {formError ? (
          <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Registering…" : "Register device"}
        </Button>
      </form>
    </div>
  );
}
