import { env } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="border-t border-border-default">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 text-text-muted [font:var(--text-mono-s)]">
        <span>aina &middot; plant monitoring</span>
        <span>
          API <span className="text-text-primary">{env.apiUrl}</span>
        </span>
      </div>
    </footer>
  );
}
