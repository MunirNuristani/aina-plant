"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

// Ported from the mockup's shared back-button + title row, used across
// plant detail, add-plant, device pairing, and device detail -- screens
// that live outside the (tabs) route group and so get no bottom tab bar.
// Pass backHref for plain navigation (renders a Link) or onBack for a JS
// handler (e.g. stepping back within a multi-step flow) -- exactly one is
// expected.
export function BackHeader({
  title,
  subtitle,
  backHref,
  onBack,
  trailing,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  const backButtonClass =
    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-pill text-text-primary transition-colors hover:bg-moss-tint";

  return (
    <div className="flex items-center gap-2.5">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className={backButtonClass}>
          <ChevronLeft size={20} />
        </Link>
      ) : (
        <button type="button" aria-label="Back" onClick={onBack} className={backButtonClass}>
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="flex-1">
        <div className="text-text-primary [font:var(--text-heading-m)]">{title}</div>
        {subtitle ? <div className="text-text-muted [font:var(--text-body-s)]">{subtitle}</div> : null}
      </div>
      {trailing}
    </div>
  );
}
