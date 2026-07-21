import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { getSessionEmail } from "@/lib/session";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const email = await getSessionEmail();

  return (
    <header className="border-b border-border-default bg-surface-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-action-primary">
          {/* eslint-disable-next-line @next/next/no-img-element -- local SVG, next/image optimizer blocks SVG by default */}
          <img src="/assets/logo.svg" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="font-semibold tracking-tight [font:var(--text-heading-l)]">aina</span>
        </Link>
        <div className="flex items-center gap-5">
          {email ? (
            <div className="flex items-center gap-3">
              <Link
                href="/plants"
                className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-action-primary [font:var(--text-label)]"
              >
                plants
              </Link>
              <span className="text-text-muted [font:var(--text-mono-s)]">{email}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-action-primary [font:var(--text-label)]"
                >
                  log out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="primary" size="s">
                log in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
