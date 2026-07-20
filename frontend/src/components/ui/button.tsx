"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "text";
type ButtonSize = "s" | "m" | "l";

// Ported from the AINA Design System's components/core/Button.jsx --
// hover/press states become Tailwind hover:/active: variants instead of
// the source's manual onMouseEnter/onMouseDown state, everything else
// (padding, radius, colors, transition timing) matches exactly.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action-primary text-text-on-primary hover:bg-action-primary-hover",
  secondary: "bg-action-secondary text-text-on-primary hover:bg-[#4C6449]",
  accent: "bg-action-accent text-text-on-accent hover:bg-action-accent-hover",
  ghost: "border border-border-strong bg-transparent text-text-primary hover:bg-moss-tint",
  text: "bg-transparent px-[2px] py-1 text-text-link hover:text-text-link-hover",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  s: "px-[14px] py-2 [font:var(--text-body-s)]",
  m: "px-[18px] py-[11px] [font:var(--text-heading-s)]",
  l: "px-[22px] py-[14px] [font:var(--text-heading-s)]",
};

export function Button({
  variant = "primary",
  size = "m",
  disabled,
  children,
  className = "",
  type = "button",
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-m border border-transparent transition-[background-color,color,transform,border-color] duration-[120ms] ease-[var(--ease-standard)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
