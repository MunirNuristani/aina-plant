# design-sync notes for aina-plant/frontend

## Product direction: PWA, mobile-first

The app is intended to be a PWA and is being built mobile-first. Nothing
PWA-specific exists yet as of this sync (no manifest, no service worker,
no `next-pwa`/similar in `package.json` or `next.config.ts`) — this is
forward direction, not current state. Implications for this sync:

- Author/grade component previews at mobile viewport widths first, not
  desktop — a card that only looks right at 1280px is the wrong bar here.
- When PWA scaffolding (manifest, icons, install prompt, offline states)
  lands in the app, it belongs in a future sync's scope — call it out
  explicitly rather than silently sweeping `manifest.json`/icons in via
  the generic `src/` scan.
- Any conventions-header guidance about layout/responsiveness should lead
  with mobile, not treat it as an afterthought breakpoint.

## Repo shape

This is a plain Next.js app, not a published component library — no
Storybook, no `main`/`module`/`exports` in `package.json`, no `dist/`.
The user explicitly chose to sync it anyway (no-dist "synth-entry" mode)
rather than skip. Expect a thin result: 4 components, weaker generated
`.d.ts` contracts than a real build would give.

## Target project: re-adopted, not fresh

`projectId` points at a pre-existing "AINA Design System" project that
already contained a substantially richer, separately hand-built component
library (Button/Badge/Card/Dialog/Toast/Tooltip/Checkbox/Input/Radio/
Select/Switch/Tabs/etc.), design tokens, and two full UI-kit mockups
(`aina-app`, `aina-dashboard`, including a `PlantDetail` screen) — none of
which come from this repo. The user was warned twice, explicitly, that
re-adopting means those files get deleted and replaced by this sync's
much thinner output, and confirmed proceeding both times. If a future
sync surprises anyone by "losing" the old component library, that's why
— it's expected, not a bug.

## `cssEntry` is a hashed build artifact — never point it at the literal hash

Turbopack's production build emits the app's compiled CSS (Tailwind
utilities + the AINA `--color-*` custom properties + self-hosted
`@font-face` rules, all real, all resolved) as a single file under
`.next/static/chunks/<hash>.css`. The hash changes on every build, so
`cfg.cssEntry` points at a **stable-named copy**:
`.next/static/chunks/compiled-styles.css`. `cfg.buildCmd` does the build
and the copy together in one line — always run it (not a bare
`npm run build`) before the converter, or `cssEntry` goes stale/missing.

**The stable copy must stay a SIBLING of the hashed file, inside
`.next/static/chunks/` — do not relocate it elsewhere (e.g. into
`.design-sync/.cache/`).** The compiled CSS's `@font-face` rules use
relative `url(../media/<hash>.woff2)`, resolved relative to the CSS
file's own directory. First attempt at this copied the CSS out to
`.design-sync/.cache/compiled-styles.css` — `../media/` from there
doesn't exist, so every real font file was silently dropped (bundle
still had `@font-face` rules with dangling `url()`s, zero `.woff2` files
anywhere in `ds-bundle/`, and no loud build-time error — only found by
inspecting `ds-bundle/fonts/` by hand). Keeping the copy inside
`.next/static/chunks/` next to the hashed original keeps `../media/`
resolving correctly.

Confirmed exactly one `.css` file lands in `.next/static/chunks/` today;
if the app ever grows enough global stylesheets to split into multiple
chunks, `buildCmd`'s glob copy will silently pick just one (or fail
loudly on the `cp` if the shell disagrees) — revisit then.

## `srcDir` scoped to `src/components`, deliberately

The default synth-entry scan walks all of `src/` and picks up every
PascalCase-exported value — that includes Next.js App Router route files
(`RootLayout`, `Home`, `PlantsPage`, `Loading`, `PlantsError`,
`PlantDashboardPage`, `PlantNotFound`), which are server/router-bound and
not meaningful as standalone previewable components (async data fetching
against the real API, `notFound()`, route params). Pointing `cfg.srcDir`
at `src/components` keeps the entry and the component list to the 4
actual reusable components: `LeafMark`, `SiteHeader`, `SiteFooter`,
`PlantCard`. If a genuinely reusable component ever lands outside
`src/components` (unlikely in an App Router project), it won't be picked
up automatically — add it via `componentSrcMap`.

## Resolved: `process is not defined` crashed the whole shared bundle

Hit this on the first render check — **every** component failed with
`ReferenceError: process is not defined`, and `window.Aina` had none of
the 4 components on it (`[BUNDLE_EXPORT]`). Root cause: since all 4
previews share one `_ds_bundle.js`, ANY module-scope crash anywhere in
that script aborts the whole IIFE before `window.Aina = …` at the very
end ever runs — so a crash in code only `SiteFooter` needs still breaks
`LeafMark`'s render too. Two real sources, both Next.js-runtime
assumptions esbuild's plain browser bundle doesn't share:

- `SiteHeader` (and `PlantCard`) import `next/link` — its internals read
  `process.env.*` beyond the `NODE_ENV` key the converter's esbuild
  `define` covers.
- `src/lib/env.ts` reads `process.env.NEXT_PUBLIC_API_URL` at module
  scope (and `throw`s if unset) — Next.js inlines that value at its own
  build time; esbuild here doesn't know to.

Fixed with **no script fork and no real source edits**, using the
`cfg.tsconfig` knob the converter already has: a sync-only tsconfig
(`.design-sync/tsconfig.sync.json`, `paths`-based, not used by the real
app/`next build`) remaps the two bare specifiers to tiny local shims:
`.design-sync/shims/next-link.tsx` (plain `<a>`) and
`.design-sync/shims/env.ts` (fixed placeholder `apiUrl`). The exact-match
`@/lib/env` path entry has to come BEFORE the `@/*` wildcard entry in
that file's `paths` object — the plugin iterates rules in object order and
takes the first one that both matches and resolves to a file on disk, so
the wildcard would otherwise win first every time (it's a real path too:
`src/lib/env.ts`) and mask the shim entirely.

**If a re-sync ever reintroduces this crash** (a new component starts
importing `next/link`, `next/navigation`, `next/image`, or reads
`process.env.*` some other way): check `ds-bundle/_ds_bundle.js` for
`process\.` — the bundle build log's "N inlined npm packages" dropping
to 0 after a fix, or staying high, is a fast tell. Same shim pattern
generalizes to any future Next-runtime-only import: add a `paths` entry
and a matching local shim, no script fork needed.

## Gotcha: not every AINA-token utility class exists in the compiled CSS

Tailwind only emits utility classes actually used somewhere in the
app's *current* pages/components — the underlying `--color-*` custom
properties are always defined in `:root` (never purged), but a class
like `text-secondary`, `bg-accent-warm`, or even an unused SIZE like
`h-10`/`w-16` simply isn't in `.next/static/chunks/<hash>.css` if
nothing in the app happens to use it yet. This is NOT limited to
colors — confirmed present today (full list, re-check after any resync
by grepping the compiled CSS for `\.[a-zA-Z0-9_-]+\{`):

```text
bg-accent bg-line bg-primary bg-surface border border-b border-dashed
border-line border-t flex flex-1 flex-col font-display font-mono
font-sans gap-1 gap-2 gap-3 gap-4 gap-8 grid grid-cols-1 h-2 h-4 h-5 h-6
h-8 h-28 h-full items-center justify-between justify-center max-w-3xl
max-w-md max-w-sm min-h-full mx-auto p-5 px-4 px-6 py-2 py-5 py-10 py-16
py-24 rounded rounded-full rounded-lg rounded-md text-2xl text-3xl
text-4xl text-balance text-center text-ink text-ink-muted text-lg
text-primary text-sm text-white text-xl text-xs tracking-tight
tracking-widest transition-colors transition-opacity uppercase w-2 w-6
w-48 w-64 w-full antialiased animate-pulse
```

Note the size gaps: `h-6`/`w-6` is a validated SQUARE pair; `h-10`,
`w-10`, `h-16`, `w-16`, `w-4` are ALL absent even though `h-4` exists —
sizes don't come in matched height/width sets just because one half
"sounds standard."

Hit this authoring `LeafMark` previews, stacked with a second, unrelated
silent failure: `text-secondary`/`text-accent` no-op instead of
erroring (SVG just inherits ambient `--color-ink`, which is dark enough
to look deceptively close to `--color-primary` at a glance — the bug
wasn't obvious from the screenshot at first look), and passing
`style={{color: "..."}}` directly to `<LeafMark>` ALSO silently did
nothing since the component only accepts `className` (see
`src/components/leaf-mark.tsx`) and never forwards `style` to the
underlying `<svg>`. Then `h-10 w-10`/`h-16 w-16` (invented "size
variant" classes, neither in the compiled CSS) left the SVG with no
CSS size at all, rendering at the browser's oversized replaced-element
default instead of the intended icon size. None of these three errored
— they all just silently produced *something that looked plausible in
miniature* until inspected closely.

**Resolution: stopped patching around it and simplified the preview
instead.** `LeafMark` has exactly one prop (`className`) and exactly
one real usage in the app (`h-6 w-6 text-primary` in `SiteHeader`) — it
has no genuine variant axis to demonstrate, so inventing "Sizes" and
"BrandColors" stories was manufacturing composition the DS doesn't
actually have, using untested classes as the vehicle. The preview is
now a single `Default` story matching real usage exactly — validated
classes only, nothing invented. General lesson for future previews:
before inventing a variant story, check whether the component actually
HAS that variant axis in real usage; and a preview screenshot that
"looks plausible" is never proof a class or prop actually took effect —
grep the compiled CSS for the exact class, and check the component's
real prop signature, before trusting a render.

**This must be called out explicitly in the conventions header** — the
design agent will reach for `bg-accent-warm` or an arbitrary `h-*`/`w-*`
size the moment it composes something new (e.g. a "watering event"
marker per the AINA palette's stated usage), and needs to know: prefer
the `var(--color-*)` / raw pixel values directly for anything not in
the list above (via a coloring ancestor for `currentColor`-based icons,
or inline `style` for elements that accept it), and re-check the list
after any resync — it's a moving target tied to what the app currently
renders, not a fixed DS surface.

## Re-sync risks

- `cssEntry`'s hash-copy step depends on the build still emitting exactly
  one CSS chunk under `.next/static/chunks/` — not verified against future
  Next.js/Turbopack versions.
- The 4 components are page-chrome + one data card, not general-purpose
  primitives — if the app grows a real shared component set later, this
  config's `srcDir` scoping should be revisited (it deliberately excludes
  everything outside `src/components`).
- No per-component docs/JSDoc existed at sync time — `.prompt.md` files
  are synthesized from props + previews only.
- The `next/link`/`env.ts` shims only cover what the DS's 4 components
  need today. A future component importing something else Next-runtime-
  only (`next/navigation`, `next/image`, `useRouter`, another
  `process.env.*` read) will reproduce the whole-bundle crash described
  above — same fix, new `paths` entry + shim.
- The compiled-utility-class set (previous section) will silently grow
  or shift as the real app adds pages — a preview or conventions claim
  that's accurate today can go stale without any sync error to flag it.

## Known render warns (triaged, expected — not new if seen again)

- `[RENDER_THIN] LeafMark/LeafMark.html: mounts have no text and paint
  nothing` — legitimate. `LeafMark` is a pure SVG icon with no text
  content by design; the `Default` story renders correctly (confirmed
  via `_screenshots/review/general__LeafMark.png` — a small, correctly
  colored/sized leaf glyph, not blank). The text-measurement heuristic
  behind this check doesn't apply to icon-only components.
