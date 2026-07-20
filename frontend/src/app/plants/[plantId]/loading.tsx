export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-4">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-20 animate-pulse rounded bg-border-default" />
        <div className="h-8 w-48 animate-pulse rounded bg-border-default" />
      </div>
      <div className="h-32 animate-pulse rounded-m border border-border-default bg-surface-card" />
      <div className="h-10 animate-pulse rounded-m border border-border-default bg-surface-card" />
    </div>
  );
}
