import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionEmail } from "@/lib/session";

// The wordmark header + dev-info footer, kept for the landing page ("/").
// Login/signup live in (auth) with no header/footer (see (auth)/layout.tsx),
// and (tabs) screens use the bottom tab bar instead (see (tabs)/layout.tsx).
// The footer (dev-info: API URL) is only useful once there's a signed-in
// session to debug -- signed-out visitors just get the header + page.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const email = await getSessionEmail();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      {email ? <SiteFooter /> : null}
    </div>
  );
}
