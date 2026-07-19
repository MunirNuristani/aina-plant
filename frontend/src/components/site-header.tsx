import Link from "next/link";
import { LeafMark } from "./leaf-mark";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-primary">
          <LeafMark className="h-6 w-6" />
          <span className="font-display text-xl tracking-tight">aina</span>
        </Link>
        <Link
          href="/plants"
          className="font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors hover:text-primary"
        >
          plants
        </Link>
      </div>
    </header>
  );
}
