"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Droplet } from "lucide-react";
import { createCareEventAction } from "@/lib/actions/care-events";
import { toLocalDateTimeInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const FORM_ID = "log-watering-form";

// Renders both its own trigger (a "Log watering" Button, matching the
// mockup's Care tab) and the Dialog it opens -- self-contained so the Care
// tab can just drop this in without lifting any dialog state up.
export function LogWateringForm({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function openDialog() {
    setFormError(null);
    setFieldErrors({});
    setOccurredAt(toLocalDateTimeInputValue(new Date()));
    setAmount("");
    setUnit("");
    setNotes("");
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side pass for immediate feedback — the API remains the
    // authority (its VALIDATION_ERROR details, surfaced below, are what
    // actually drive "clear validation errors" if this misses anything).
    const errors: Record<string, string> = {};

    if (occurredAt.trim() === "") {
      errors.occurredAt = "When is required.";
    }
    const occurredAtDate = new Date(occurredAt);
    if (!errors.occurredAt && Number.isNaN(occurredAtDate.getTime())) {
      errors.occurredAt = "Enter a valid date and time.";
    }

    const trimmedAmount = amount.trim();
    const parsedAmount = trimmedAmount === "" ? undefined : Number(trimmedAmount);
    if (parsedAmount !== undefined && (Number.isNaN(parsedAmount) || parsedAmount < 0)) {
      errors.amount = "Amount must be a number 0 or greater.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCareEventAction(plantId, {
        occurredAt: occurredAtDate.toISOString(),
        amount: parsedAmount,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        // Deliberately does NOT reset occurredAt/amount/unit/notes here —
        // the user's input stays exactly as typed so they can fix and
        // resubmit.
        setFieldErrors(result.fieldErrors);
        if (result.formError) {
          setFormError(result.formError);
        }
      }
    } catch {
      setFormError("Something went wrong logging this watering.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={openDialog}>
        <span className="inline-flex items-center gap-2">
          <Droplet size={16} />
          Log watering
        </span>
      </Button>

      <Dialog
        open={open}
        title="Log watering"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" form={FORM_ID} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
          <Input
            id="occurredAt"
            label="Date and time"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
            error={fieldErrors.occurredAt}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                id="amount"
                label="Amount"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="250"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                error={fieldErrors.amount}
              />
            </div>
            <div className="w-24">
              <Input
                id="unit"
                label="Unit"
                placeholder="ml"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
            </div>
          </div>
          <Input
            id="notes"
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {formError ? (
            <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
              {formError}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
