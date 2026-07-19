"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createCareEventAction } from "@/lib/actions/care-events";
import { toLocalDateTimeInputValue } from "@/lib/format";

export function LogWateringForm({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSuccess(false);

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
        // Success: fresh form, confirmation, and the server-rendered
        // dashboard (moisture card, history, device status) re-fetched.
        setSuccess(true);
        setAmount("");
        setUnit("");
        setNotes("");
        setOccurredAt(toLocalDateTimeInputValue(new Date()));
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Log watering</p>

      <div className="flex flex-col gap-1">
        <label htmlFor="occurredAt" className="text-sm text-ink">
          When
        </label>
        <input
          id="occurredAt"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
        />
        {fieldErrors.occurredAt ? <p className="text-sm text-error">{fieldErrors.occurredAt}</p> : null}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="amount" className="text-sm text-ink">
            Amount <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="250"
            className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
          />
          {fieldErrors.amount ? <p className="text-sm text-error">{fieldErrors.amount}</p> : null}
        </div>
        <div className="flex w-24 flex-col gap-1">
          <label htmlFor="unit" className="text-sm text-ink">
            Unit
          </label>
          <input
            id="unit"
            type="text"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="ml"
            className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
          />
          {fieldErrors.unit ? <p className="text-sm text-error">{fieldErrors.unit}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm text-ink">
          Notes <span className="text-ink-muted">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Morning watering, soil felt dry"
          className="resize-none rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
        />
        {fieldErrors.notes ? <p className="text-sm text-error">{fieldErrors.notes}</p> : null}
      </div>

      {formError ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-ink">{formError}</p> : null}
      {success ? <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-ink">Watering logged.</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Logging…" : "Log watering"}
      </button>
    </form>
  );
}
