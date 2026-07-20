import { CareEventRow } from "@/components/care-event-row";
import { Card } from "@/components/ui/card";
import type { CareEvent } from "@/lib/types";

// Server-rendered structural wrapper — CareEventRow is the only part that
// needs to be a Client Component (edit/delete interactivity).
export function CareEventList({ plantId, careEvents }: { plantId: string; careEvents: CareEvent[] }) {
  return (
    <Card className="flex flex-col gap-4">
      <p className="uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
        Watering history
      </p>

      {careEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-m border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="text-text-primary [font:var(--text-body-m)]">No watering logged yet</p>
          <p className="max-w-xs text-text-muted [font:var(--text-body-s)]">
            Log a watering above and it will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {careEvents.map((event) => (
            <CareEventRow key={event.id} plantId={plantId} event={event} />
          ))}
        </div>
      )}
    </Card>
  );
}
