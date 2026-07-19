// design-sync build-time stand-in for src/lib/env.ts — see
// shims/next-link.tsx for the pattern this follows. The real module reads
// process.env.NEXT_PUBLIC_API_URL at module scope (and throws if it's
// unset) so Next.js's own build can inline the value; esbuild doesn't do
// that Next-specific inlining, so the bare `process` reference throws in
// this browser IIFE and crashes the whole shared bundle. A fixed
// placeholder is fine here — no real network calls happen from a static
// preview card.
export const env = {
  apiUrl: "https://example.com/api/v1",
};
