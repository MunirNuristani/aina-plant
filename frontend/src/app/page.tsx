export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl tracking-tight text-ink sm:text-5xl">
          Your greenhouse is quiet
        </h1>
        <p className="mx-auto max-w-md text-balance text-ink-muted">
          Connect a device and its readings will start showing up here.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-lg border border-dashed border-line px-6 py-10 font-mono text-xs uppercase tracking-widest text-ink-muted">
        waiting for the first reading&hellip;
      </div>
    </div>
  );
}
