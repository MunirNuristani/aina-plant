import Link from "next/link";
import { LeafMark } from "./leaf-mark";
import { logoutAction } from "@/lib/actions/auth";
import { getSessionEmail } from "@/lib/session";

export async function SiteHeader() {
  const email = await getSessionEmail();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-primary">
          <LeafMark className="h-6 w-6" />
          <span className="font-display text-xl tracking-tight">aina</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/plants"
            className="font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors hover:text-primary"
          >
            plants
          </Link>
          {email ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-muted">{email}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors hover:text-primary"
                >
                  log out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors hover:text-primary"
              >
                log in
              </Link>
              <Link
                href="/signup"
                className="font-mono text-xs uppercase tracking-widest text-ink-muted transition-colors hover:text-primary"
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
