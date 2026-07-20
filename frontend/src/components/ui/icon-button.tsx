"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "primary" | "ghost" | "plain";
type IconButtonSize = "s" | "m" | "l";

// Ported from components/core/IconButton.jsx.
const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  primary:
    "border border-transparent bg-action-primary text-text-on-primary hover:bg-action-primary-hover",
  ghost: "border border-border-default bg-transparent text-text-primary hover:bg-moss-tint",
  plain: "border border-transparent bg-transparent text-text-primary hover:bg-moss-tint",
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  s: "h-8 w-8",
  m: "h-10 w-10",
  l: "h-12 w-12",
};

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "m",
  disabled,
  className = "",
  ...props
}: {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-m transition-colors duration-[120ms] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
