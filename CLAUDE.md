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
- **Design tokens live in the `@theme` block of `src/app/globals.css`.** Components
  reference token names (`text-term-accent`), never raw colours. Restyling should be a
  token edit plus component markup — never a change to `src/server/` or `src/lib/`.
- **Search results must not carry tab content.** `localProvider.search` parses through
  `songSummarySchema` specifically to strip it.
- **E2E runs with `TAB_PROVIDERS=local`** (set in `playwright.config.ts`) so it is
  deterministic and offline. Don't write e2e assertions against Songsterr results.

## Current state

The UI is structural only — semantic markup with tokens, awaiting a visual pass.
Motion/3D packages (`gsap`, `motion`, `lenis`, `three`, `@react-three/*`) are installed
but not imported anywhere, so they cost nothing until used.
