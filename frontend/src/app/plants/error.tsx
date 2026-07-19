"use client";

import { useEffect } from "react";

export default function PlantsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-2xl tracking-tight text-ink">
        Couldn&rsquo;t load your plants
      </h1>
      <p className="max-w-sm text-ink-muted">
        Something went wrong talking to the API. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
