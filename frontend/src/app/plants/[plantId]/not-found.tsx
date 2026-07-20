import Link from "next/link";

export default function PlantNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-text-primary [font:var(--text-heading-l)]">Plant not found</h1>
      <p className="max-w-sm text-text-muted [font:var(--text-body-m)]">
        This plant doesn&rsquo;t exist, or may have been removed.
      </p>
      <Link
        href="/plants"
        className="rounded-m bg-action-primary px-4 py-2 text-text-on-primary transition-colors hover:bg-action-primary-hover [font:var(--text-heading-s)]"
      >
        Back to plants
      </Link>
    </div>
  );
}
