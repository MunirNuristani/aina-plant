"use client";

import type { ChangeEvent } from "react";

// Ported from components/forms/Switch.jsx, with one fix: the source wires
// onClick onto the visual pill only, so clicking the label text next to it
// does nothing -- not just a nice-to-have, it also means the source has no
// keyboard support at all (a bare span isn't focusable). This version
// wraps a real (visually hidden) checkbox input inside the label instead,
// which gets label-click-activates-control, Tab focus, and Space-to-toggle
// for free, while looking identical (the decorative pill is aria-hidden).
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.checked);
  }

  return (
    <label
      className={`inline-flex items-center gap-2.5 text-text-primary [font:var(--text-body-m)] ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-block h-[22px] w-[38px] rounded-pill transition-colors duration-200 ease-[var(--ease-standard)] ${
          checked ? "bg-action-accent" : "bg-border-strong"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-card transition-[left] duration-200 ease-[var(--ease-standard)] ${
            checked ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </span>
      {label}
    </label>
  );
}
