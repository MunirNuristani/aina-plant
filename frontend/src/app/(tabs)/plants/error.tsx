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
      <h1 className="text-text-primary [font:var(--text-heading-l)]">Couldn&rsquo;t load your plants</h1>
      <p className="max-w-sm text-text-muted [font:var(--text-body-m)]">
        Something went wrong talking to the API. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-m bg-action-primary px-4 py-2 text-text-on-primary transition-colors hover:bg-action-primary-hover [font:var(--text-heading-s)]"
      >
        Try again
      </button>
    </div>
  );
}
