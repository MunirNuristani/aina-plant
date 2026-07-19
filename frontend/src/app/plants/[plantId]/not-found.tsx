import Link from "next/link";

export default function PlantNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-2xl tracking-tight text-ink">Plant not found</h1>
      <p className="max-w-sm text-ink-muted">
        This plant doesn&rsquo;t exist, or may have been removed.
      </p>
      <Link
        href="/plants"
        className="rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90"
      >
        Back to plants
      </Link>
    </div>
  );
}
