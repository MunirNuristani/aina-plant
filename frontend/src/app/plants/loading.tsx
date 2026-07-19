export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded bg-line" />
        <div className="h-5 w-64 animate-pulse rounded bg-line" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-28 flex-col justify-between rounded-lg border border-line bg-surface p-5"
          >
            <div className="h-5 w-2/3 animate-pulse rounded bg-line" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
