# GTabsTerm — working notes

Guitar tab search. Next.js 16 App Router, React 19 + React Compiler, Tailwind v4, Biome.
See `README.md` for the full stack table and architecture.

## Before you finish a change

```bash
npm run check     # typecheck + biome + vitest
```

## Rules that matter here

- **Formatting is Biome, not Prettier/ESLint.** `npm run lint:fix` before committing.
  `biome.json` is parsed strictly — do not put `//` comments in it, it silently falls
  back to defaults.
- **Tab data never lives in components.** Sources implement `TabProvider`
  (`src/server/tabs/types.ts`) and are registered in `src/server/tabs/registry.ts`.
  A new source is a new file in `providers/` plus an entry in `TAB_PROVIDERS`.
- **ASCII tablature is a fixed-width grid.** `.tab-content` must keep `white-space: pre`
  and a monospace font with ligatures off. If it reflows, the tab is wrong.
- **Design tokens are the `--tt-*` variables in `src/app/globals.css`** (one block per
  theme: paper/crt/amber/mono, switched by `data-theme` via next-themes). The
  `@theme inline` block maps them to `term-*` utilities; components reference those
  names (`text-term-accent`), never raw colours. Restyling should be a token edit plus
  component markup — never a change to `src/server/` or `src/lib/`.
- **Search results must not carry tab content.** `localProvider.search` parses through
  `songSummarySchema` specifically to strip it.
- **`searchAllProviders` may only narrow `TAB_PROVIDERS`, never widen it.** The
  `provider` query param is a client-supplied filter; treating it as a way to enable a
  source would let anyone switch on what the operator turned off. There is an e2e test
  pinning this.
- **Capability is decided in one place**, `deriveCapability` in `src/server/tabs/types.ts`.
  Providers call it instead of hard-coding a badge value.
- **The source filter (`/src`) is session-only on purpose.** With no indicator in the
  header, a filter that survived a reload would silently haunt the reader. Do not add
  `persist` to `src/stores/prefs.ts` without also adding a visible indicator.
- **The daily quote is picked on the server** (`src/data/quotes.ts` + `revalidate` on
  the home page), never client-side — computing it during render on both sides is a
  hydration mismatch waiting for midnight.
- **E2E runs with `TAB_PROVIDERS=local`** (set in `playwright.config.ts`) so it is
  deterministic and offline. Don't write e2e assertions against Songsterr results.

## Current state

The UI implements the TabsTerm design imported from Claude Design ("TabsTerm –
Plataforma de tabs", `TabsTerm.dc.html`): terminal prompt with ghost-typing, results/
favs screens, tab view with playback bar, about/auth/⌘K modals, keyboard-first. The
auth modal is a client-side mock by design; favorites are session-only in a zustand
store. Motion/3D packages (`gsap`, `motion`, `lenis`, `three`, `@react-three/*`) remain
installed but unused, so they cost nothing until needed.
