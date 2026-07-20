export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-text-primary [font:var(--text-display-l)]">Your greenhouse is quiet</h1>
        <p className="mx-auto max-w-md text-balance text-text-secondary [font:var(--text-body-l)]">
          Connect a device and its readings will start showing up here.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-m border border-dashed border-border-strong px-6 py-10 uppercase tracking-[var(--tracking-label)] text-text-muted [font:var(--text-label)]">
        waiting for the first reading&hellip;
      </div>
    </div>
  );
}
