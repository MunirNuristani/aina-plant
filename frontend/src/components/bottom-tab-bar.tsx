"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Cpu, Leaf, Settings } from "lucide-react";
import type { ComponentType } from "react";

const TABS: { href: string; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { href: "/plants", label: "Plants", icon: Leaf },
  { href: "/devices", label: "Devices", icon: Cpu },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Ported from ui_kits/aina-app/TabBar.jsx, extended with a 4th "Devices"
// tab -- the raw ui_kits source has only 3 (Plants/Alerts/Settings), but
// the user-provided AINA App.dc.html mockup (the more recent artifact)
// adds Devices as its own tab, which this app's real device-management
// features need. Rendered only inside (tabs)/layout.tsx -- absent on
// auth/welcome/detail/add/pairing screens, matching the mockup's
// isListScreen gating.
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex border-t border-border-default bg-surface-card pt-2 pb-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 uppercase tracking-[var(--tracking-label)] [font:var(--text-label)] ${
              active ? "text-action-primary" : "text-text-muted"
            }`}
          >
            <Icon size={22} strokeWidth={1.5} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
