"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { deleteCareEventAction, updateCareEventAction } from "@/lib/actions/care-events";
import { formatDateTime, toLocalDateTimeInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        className="flex flex-col gap-3 border-b border-border-default py-4 last:border-0"
      >
        <Input
          id={`occurredAt-${event.id}`}
          label="When"
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          error={fieldErrors.occurredAt}
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id={`amount-${event.id}`}
              label="Amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={fieldErrors.amount}
            />
          </div>
          <div className="w-24">
            <Input
              id={`unit-${event.id}`}
              label="Unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>
        {/* Real backend constraint, not a UI limitation invented here — see
            lib/actions/care-events.ts's UpdateCareEventInput comment: the
            API has no way to clear an already-set amount/unit, only change
            it, so the honest thing is to say so rather than let a blanked
            field silently fail to clear. */}
        <p className="text-text-muted [font:var(--text-body-s)]">
          Leave amount or unit blank to keep their current value — neither can be cleared once set, only changed.
        </p>

        <label htmlFor={`notes-${event.id}`} className="flex flex-col gap-1.5 [font:var(--text-body-s)]">
          <span className="text-text-secondary tracking-[var(--tracking-label)] [font:var(--text-label)]">
            Notes
          </span>
          <textarea
            id={`notes-${event.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="resize-none rounded-s border border-border-strong bg-surface-card px-3 py-2.5 text-text-primary outline-none [font:var(--text-body-m)]"
          />
        </label>

        {formError ? (
          <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
            {formError}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="s" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="s" onClick={cancelEdit} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-border-default py-4 last:border-0 ${deleting ? "opacity-50" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <p className="text-text-primary [font:var(--text-body-m)]">{formatDateTime(event.occurredAt)}</p>
        {event.amount !== null ? (
          <p className="text-text-muted [font:var(--text-mono-s)]">
            {event.amount}
            {event.unit ? ` ${event.unit}` : ""}
          </p>
        ) : null}
        {event.notes ? <p className="text-text-muted [font:var(--text-body-s)]">{event.notes}</p> : null}
        {formError ? <p className="text-critical [font:var(--text-body-s)]">{formError}</p> : null}
      </div>

      {mode === "confirm-delete" ? (
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="primary"
            size="s"
            onClick={handleDelete}
            disabled={deleting}
            className="!bg-critical hover:!bg-[#8f2e24]"
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </Button>
          <Button type="button" variant="ghost" size="s" onClick={() => setMode("view")} disabled={deleting}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={startEdit}
            className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-action-primary [font:var(--text-label)]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-delete")}
            className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-critical [font:var(--text-label)]"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
