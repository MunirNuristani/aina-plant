import { BottomTabBar } from "@/components/bottom-tab-bar";

// The 4 main app screens (Plants/Devices/Alerts/Settings) -- each owns its
// own in-content title (no shared top header), with the bottom tab bar
// pinned below. Matches the mockup's isListScreen gating: this bar is
// absent on auth/welcome/detail/add/pairing screens, all of which live
// outside this route group.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomTabBar />
    </div>
  );
}
