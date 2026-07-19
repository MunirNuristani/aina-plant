"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { deleteCareEventAction, updateCareEventAction } from "@/lib/actions/care-events";
import { formatDateTime, toLocalDateTimeInputValue } from "@/lib/format";
import type { CareEvent } from "@/lib/types";

type Mode = "view" | "edit" | "confirm-delete";

export function CareEventRow({ plantId, event }: { plantId: string; event: CareEvent }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date(event.occurredAt)));
  const [amount, setAmount] = useState(event.amount !== null ? String(event.amount) : "");
  const [unit, setUnit] = useState(event.unit ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    setOccurredAt(toLocalDateTimeInputValue(new Date(event.occurredAt)));
    setAmount(event.amount !== null ? String(event.amount) : "");
    setUnit(event.unit ?? "");
    setNotes(event.notes ?? "");
    setFieldErrors({});
    setFormError(null);
    setMode("edit");
  }

  function cancelEdit() {
    setFieldErrors({});
    setFormError(null);
    setMode("view");
  }

  async function handleSave(event_: FormEvent<HTMLFormElement>) {
    event_.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    const occurredAtDate = new Date(occurredAt);
    if (occurredAt.trim() === "" || Number.isNaN(occurredAtDate.getTime())) {
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
      const result = await updateCareEventAction(plantId, event.id, {
        occurredAt: occurredAtDate.toISOString(),
        amount: parsedAmount,
        unit: unit.trim() || undefined,
        notes: notes.trim(),
      });

      if (result.ok) {
        setMode("view");
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors);
        if (result.formError) {
          setFormError(result.formError);
        }
      }
    } catch {
      setFormError("Something went wrong saving this change.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setFormError(null);
    try {
      const result = await deleteCareEventAction(plantId, event.id);
      if (result.ok) {
        router.refresh();
        // Stays "deleting" (dimmed) until refresh brings a list without
        // this row — no reason to flip back to a normal view first.
      } else {
        setFormError(result.error);
        setDeleting(false);
        // Stays in confirm-delete mode so the retry is one click, not two.
      }
    } catch {
      setFormError("Something went wrong deleting this entry.");
      setDeleting(false);
    }
  }

  if (mode === "edit") {
    return (
      <form
        onSubmit={handleSave}
        noValidate
        className="flex flex-col gap-3 border-b border-line py-4 last:border-0"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`occurredAt-${event.id}`} className="text-sm text-ink">
            When
          </label>
          <input
            id={`occurredAt-${event.id}`}
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
          />
          {fieldErrors.occurredAt ? <p className="text-sm text-error">{fieldErrors.occurredAt}</p> : null}
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={`amount-${event.id}`} className="text-sm text-ink">
              Amount
            </label>
            <input
              id={`amount-${event.id}`}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
            />
            {fieldErrors.amount ? <p className="text-sm text-error">{fieldErrors.amount}</p> : null}
          </div>
          <div className="flex w-24 flex-col gap-1">
            <label htmlFor={`unit-${event.id}`} className="text-sm text-ink">
              Unit
            </label>
            <input
              id={`unit-${event.id}`}
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
            />
          </div>
        </div>
        {/* Real backend constraint, not a UI limitation invented here — see
            lib/actions/care-events.ts's UpdateCareEventInput comment: the
            API has no way to clear an already-set amount/unit, only change
            it, so the honest thing is to say so rather than let a blanked
            field silently fail to clear. */}
        <p className="text-xs text-ink-muted">
          Leave amount or unit blank to keep their current value — neither can be cleared once set, only changed.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={`notes-${event.id}`} className="text-sm text-ink">
            Notes
          </label>
          <textarea
            id={`notes-${event.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="resize-none rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
          />
        </div>

        {formError ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-ink">{formError}</p> : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={submitting}
            className="rounded-md border border-line px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-line py-4 last:border-0 ${deleting ? "opacity-50" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink">{formatDateTime(event.occurredAt)}</p>
        {event.amount !== null ? (
          <p className="font-mono text-sm text-ink-muted">
            {event.amount}
            {event.unit ? ` ${event.unit}` : ""}
          </p>
        ) : null}
        {event.notes ? <p className="text-sm text-ink-muted">{event.notes}</p> : null}
        {formError ? <p className="text-sm text-error">{formError}</p> : null}
      </div>

      {mode === "confirm-delete" ? (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-error px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={deleting}
            className="rounded-md border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={startEdit}
            className="font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-primary"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            className="font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-error"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
