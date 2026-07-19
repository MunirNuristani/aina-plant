import { CareEventRow } from "@/components/care-event-row";
import type { CareEvent } from "@/lib/types";

// Server-rendered structural wrapper — CareEventRow is the only part that
// needs to be a Client Component (edit/delete interactivity).
export function CareEventList({ plantId, careEvents }: { plantId: string; careEvents: CareEvent[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Watering history</p>

      {careEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-line px-6 py-12 text-center">
          <p className="text-ink">No watering logged yet</p>
          <p className="max-w-xs text-sm text-ink-muted">Log a watering above and it will show up here.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {careEvents.map((event) => (
            <CareEventRow key={event.id} plantId={plantId} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
