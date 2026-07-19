import { LeafMark } from "@/components/leaf-mark";

// LeafMark's only real usage in the app today is exactly this — 24px, in
// SiteHeader, colored via an ancestor's text-primary. It has no other
// variant axis (className is its only prop), so a single canonical story
// matching real usage is more honest than inventing sizes/colors via
// Tailwind classes the compiled CSS doesn't actually ship yet (nothing in
// the app currently uses h-10/w-10/h-16/w-16/text-secondary/text-accent —
// see .design-sync/NOTES.md's "not every AINA-token utility class exists in
// the compiled CSS" section).
export function Default() {
  return <LeafMark className="h-6 w-6 text-primary" />;
}
