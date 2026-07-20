import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// The wordmark header + dev-info footer, kept for the landing page ("/").
// Login/signup live in (auth) with no header/footer (see (auth)/layout.tsx),
// and (tabs) screens use the bottom tab bar instead (see (tabs)/layout.tsx).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
