"use client";

import type { MouseEventHandler, ReactNode } from "react";

// Ported from components/data/Card.jsx -- hover-raises-shadow becomes a
// Tailwind hover: variant (only applied when interactive) instead of the
// source's manual onMouseEnter state.
export function Card({
  children,
  interactive,
  padding = "p-5",
  onClick,
  className = "",
}: {
  children: ReactNode;
  interactive?: boolean;
  padding?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-m border border-border-default bg-surface-card shadow-card transition-shadow duration-200 ease-[var(--ease-standard)] ${
        interactive ? "cursor-pointer hover:shadow-raised" : "cursor-default"
      } ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
