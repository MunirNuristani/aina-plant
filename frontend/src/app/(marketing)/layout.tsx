import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// The wordmark header + dev-info footer, kept for the pages outside the
// mobile app shell: landing ("/"), login, signup. Screens inside (tabs)
// use the bottom tab bar instead (see (tabs)/layout.tsx) -- the mockup
// this app is being restyled to match shows no top wordmark bar on those
// screens, only each screen's own in-content title.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
