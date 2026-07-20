"use client";

import type { InputHTMLAttributes } from "react";

// Ported from components/forms/Input.jsx -- focus state becomes a
// Tailwind focus: variant on the native input instead of the source's
// manual onFocus/onBlur state. Uses standard InputHTMLAttributes (the
// event object in onChange) rather than the source's value-only callback,
// to match how every existing form in this codebase already calls
// onChange (see components/log-watering-form.tsx).
export function Input({
  label,
  error,
  className = "",
  disabled,
  ...props
}: {
  label?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex w-full flex-col gap-1.5 [font:var(--text-body-s)]">
      {label ? (
        <span className="text-text-secondary tracking-[var(--tracking-label)] [font:var(--text-label)]">
          {label}
        </span>
      ) : null}
      <input
        disabled={disabled}
        className={`rounded-s border px-3 py-2.5 text-text-primary outline-none transition-[box-shadow,border-color] duration-[120ms] ease-[var(--ease-standard)] [font:var(--text-body-m)] ${
          disabled ? "bg-surface-sunken" : "bg-surface-card"
        } ${
          error
            ? "border-critical"
            : "border-border-strong focus:border-border-focus focus:shadow-[var(--shadow-focus-ring)]"
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-critical [font:var(--text-body-s)]">{error}</span> : null}
    </label>
  );
}
