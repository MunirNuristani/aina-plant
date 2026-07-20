"use client";

import type { ReactNode } from "react";

type BadgeTone = "healthy" | "warning" | "critical" | "info" | "neutral";

// Ported from components/core/Badge.jsx.
const TONE_CLASSES: Record<BadgeTone, string> = {
  healthy: "bg-status-healthy-bg text-status-healthy-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  critical: "bg-status-critical-bg text-status-critical-fg",
  info: "bg-status-info-bg text-status-info-fg",
  neutral: "bg-moss-tint text-text-secondary",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-[10px] py-[3px] uppercase tracking-[var(--tracking-label)] [font:var(--text-label)] ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
