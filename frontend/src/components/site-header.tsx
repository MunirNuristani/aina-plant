import { LeafMark } from "./leaf-mark";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 text-ink">
          <LeafMark className="h-6 w-6 text-verdigris" />
          <span className="font-display text-xl tracking-tight">aina</span>
        </div>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          plant dashboard
        </span>
      </div>
    </header>
  );
}
