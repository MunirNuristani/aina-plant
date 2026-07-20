"use client";

// Ported from components/navigation/Tabs.jsx. Used for in-page sub-tabs
// (e.g. plant detail's Overview/History/Care) -- distinct from
// bottom-tab-bar.tsx, the app-level bottom navigation.
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-border-default">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`mr-5 -mb-px px-1 py-2.5 transition-colors duration-[120ms] ease-[var(--ease-standard)] [font:var(--text-heading-s)] ${
              active
                ? "border-b-2 border-action-primary text-text-primary"
                : "border-b-2 border-transparent text-text-muted"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
