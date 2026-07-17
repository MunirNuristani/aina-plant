export function LeafMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M16 4C22 6 26 12 24 18C22 24 16 27 16 27C16 27 10 24 8 18C6 12 10 6 16 4Z"
        strokeWidth="1.6"
      />
      <path d="M16 6V22" strokeWidth="1.2" />
      <path
        d="M16 22V27M16 27H21M21 27V29.6"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="30" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
