import Link from "next/link";
import { LeafMark } from "./leaf-mark";
import { logoutAction } from "@/lib/actions/auth";
import { getSessionEmail } from "@/lib/session";

export async function SiteHeader() {
  const email = await getSessionEmail();

  return (
    <header className="border-b border-border-default bg-surface-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-action-primary">
          <LeafMark className="h-6 w-6" />
          <span className="font-semibold tracking-tight [font:var(--text-heading-l)]">aina</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/plants"
            className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-action-primary [font:var(--text-label)]"
          >
            plants
          </Link>
          {email ? (
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-action-primary [font:var(--text-label)]"
              >
                log in
              </Link>
              <Link
                href="/signup"
                className="uppercase tracking-[var(--tracking-label)] text-text-muted transition-colors hover:text-action-primary [font:var(--text-label)]"
              >
                sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
