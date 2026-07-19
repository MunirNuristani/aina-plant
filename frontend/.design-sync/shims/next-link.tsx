import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
};

// design-sync build-time stand-in for next/link's default export — used ONLY
// by the sync's own esbuild bundle (see .design-sync/tsconfig.sync.json).
// The real app always imports the real next/link; this file never ships to
// or runs in production. next/link's internals read process.env values
// beyond what the converter's esbuild `define` covers, which throws
// `ReferenceError: process is not defined` in a plain browser IIFE and takes
// down the whole shared design-system bundle. A plain anchor is faithful
// enough for a preview card (no client-side router needed there).
export default function Link({ href, children, ...rest }: LinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
