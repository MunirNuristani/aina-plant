import { env } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 font-mono text-xs text-ink-muted">
        <span>aina &middot; plant monitoring</span>
        <span>
          API <span className="text-ink">{env.apiUrl}</span>
        </span>
      </div>
    </footer>
  );
}
