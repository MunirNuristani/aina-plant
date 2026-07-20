"use client";

type PillStatus = "healthy" | "watch" | "critical" | "offline";

// Ported from components/data/StatusPill.jsx.
const STATUS_CLASSES: Record<PillStatus, { pill: string; dot: string; defaultLabel: string }> = {
  healthy: { pill: "bg-status-healthy-bg text-status-healthy-fg", dot: "bg-[#3D6B37]", defaultLabel: "Healthy" },
  watch: { pill: "bg-status-warning-bg text-status-warning-fg", dot: "bg-[#8A4A26]", defaultLabel: "Watch" },
  critical: { pill: "bg-status-critical-bg text-status-critical-fg", dot: "bg-critical", defaultLabel: "Critical" },
  offline: { pill: "bg-surface-sunken text-text-muted", dot: "bg-text-muted", defaultLabel: "Offline" },
};

export function StatusPill({ status = "healthy", label }: { status?: PillStatus; label?: string }) {
  const s = STATUS_CLASSES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill py-1 pr-[10px] pl-2 uppercase tracking-[var(--tracking-label)] [font:var(--text-label)] ${s.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {label || s.defaultLabel}
    </span>
  );
}
