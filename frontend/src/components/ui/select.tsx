"use client";

import type { SelectHTMLAttributes } from "react";

// Ported from components/forms/Select.jsx.
export function Select({
  label,
  options,
  className = "",
  disabled,
  ...props
}: {
  label?: string;
  options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex w-full flex-col gap-1.5 [font:var(--text-body-s)]">
      {label ? (
        <span className="text-text-secondary tracking-[var(--tracking-label)] [font:var(--text-label)]">
          {label}
        </span>
      ) : null}
      <select
        disabled={disabled}
        className={`appearance-none rounded-s border border-border-strong px-3 py-2.5 text-text-primary outline-none [font:var(--text-body-m)] ${
          disabled ? "bg-surface-sunken" : "bg-surface-card"
        } ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
