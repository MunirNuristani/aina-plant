"use client";

import type { MouseEvent, ReactNode } from "react";

// Ported from components/feedback/Dialog.jsx.
export function Dialog({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
}) {
  if (!open) {
    return null;
  }

  function stopPropagation(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(23,63,53,0.35)] backdrop-blur-[4px]"
    >
      <div
        onClick={stopPropagation}
        className="flex w-[400px] max-w-[90vw] flex-col gap-4 rounded-l bg-surface-card p-6 shadow-overlay"
      >
        {title ? <div className="text-text-primary [font:var(--text-heading-m)]">{title}</div> : null}
        <div className="text-text-secondary [font:var(--text-body-m)]">{children}</div>
        {footer ? <div className="mt-2 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
