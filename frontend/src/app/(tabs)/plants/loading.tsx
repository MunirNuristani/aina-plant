export default function Loading() {
  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-28 animate-pulse rounded bg-border-default" />
        <div className="h-8 w-48 animate-pulse rounded bg-border-default" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-28 flex-col justify-between rounded-m border border-border-default bg-surface-card p-5"
          >
            <div className="h-5 w-2/3 animate-pulse rounded bg-border-default" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-border-default" />
          </div>
        ))}
      </div>
    </div>
  );
}
