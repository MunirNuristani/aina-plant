// No SiteHeader/SiteFooter here -- login and signup are entry points before
// the app shell exists yet, so they render standalone per the mockup.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
