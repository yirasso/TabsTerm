# GTabsTerm — working notes

Guitar tab search. Next.js 16 App Router, React 19 + React Compiler, Tailwind v4, Biome.
See `README.md` for the full stack table and architecture, and
[docs/PLAN.md](docs/PLAN.md) for where the project is going and why.

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
- **Every notation position is two characters wide** (`CELL_WIDTH` in
  `src/lib/tab/grid.ts`): `0-`, `12` and `--` all measure the same. One character per
  position breaks the moment anyone plays above the ninth fret, because a two-digit fret
  either pushes the column out of line or silently eats the next time position.
  `normaliseGrid` re-lays hand-written tab onto it and is idempotent. If you change
  `CELL_WIDTH`, `COLUMNS_PER_BEAT` in `use-tab-playback.ts` must move with it or every
  tab changes tempo.
- **Design tokens are the `--tt-*` variables in `src/app/globals.css`** (one block per
  theme: paper/crt/amber/mono, switched by `data-theme` via next-themes). The
  `@theme inline` block maps them to `term-*` utilities; components reference those
  names (`text-term-accent`), never raw colours. Restyling should be a token edit plus
  component markup — never a change to `src/server/` or `src/lib/`.
- **`@theme inline` does not emit the custom property.** It substitutes values into the
  utilities it generates, so anything hand-written CSS reads with `var(--token)` must
  live in a plain `@theme` block instead. `--font-mono` is in one for exactly this
  reason: when it was inline, `font-family: var(--font-mono)` resolved to nothing, the
  declaration went invalid, and every tab silently rendered in a proportional font.
- **Search results must not carry tab content.** `localProvider.search` parses through
  `songSummarySchema` specifically to strip it.
- **`searchAllProviders` may only narrow `TAB_PROVIDERS`, never widen it.** The
  `provider` query param is a client-supplied filter; treating it as a way to enable a
  source would let anyone switch on what the operator turned off. There is an e2e test
  pinning this.
- **Capability is decided in one place**, `deriveCapability` in `src/server/tabs/types.ts`.
  It asks the parser whether it found notes, so `full` cannot promise sound the player
  cannot deliver.
- **Guitar tablature only.** No chord sheets, bass or ukulele. `tabTypeSchema` keeps a
  single member so one can come back cheaply, but nothing displays it.
- **Audio analysis is one path, and it produces tabs.** `/listen` runs Basic Pitch over
  a recording of one instrument. There is no chord-detection path — that was removed
  along with essentia.js.
- **The source filter (`/src`) is session-only on purpose.** With no indicator in the
  header, a filter that survived a reload would silently haunt the reader. Do not add
  `persist` to `src/stores/prefs.ts` without also adding a visible indicator.
- **The daily quote is picked on the server** (`src/data/quotes.ts` + `revalidate` on
  the home page), never client-side — computing it during render on both sides is a
  hydration mismatch waiting for midnight.
- **A command that routes away must not clear the prompt.** `setQuery("")` writes the
  URL through nuqs, and that write lands *after* a `router.push` and clobbers it back
  to `/`. `LEAVES_PROMPT` in `src/components/terminal/commands.ts` is the list; add to
  it when a new command navigates.
- **`TabProvider.random` is optional by design.** Only sources that can enumerate
  their catalog implement it; `randomTab` skips the rest instead of guessing ids.
- **E2E runs with `TAB_PROVIDERS=local`** (set in `playwright.config.ts`) so it is
  deterministic and offline. Don't write e2e assertions against Songsterr results.

## Content sources — the rule that decides everything

**Never copy tablature from another site, by any method.** A tab embodies someone
else's composition; scraping it, or transcribing it by ear and publishing it, are the
same thing legally. Content comes from three places only: users who write it under
their own account, public-domain scores with per-row licence proof, and metadata-only
links to sources that host their own (Songsterr). Audio analysis, when it lands, must
run in the browser on audio the user supplies — the server never fetches or stores
recordings. Reasoning and precedents in [docs/PLAN.md](docs/PLAN.md).

## Current state

The UI implements the TabsTerm design imported from Claude Design ("TabsTerm –
Plataforma de tabs", `TabsTerm.dc.html`): terminal prompt with ghost-typing, results/
favs screens, tab view with playback bar, about/auth/⌘K modals, keyboard-first.

What is still fake and scheduled to become real (see the plan): the auth modal is a
client-side mock, favorites are session-only in a zustand store, and the playback bar
runs a `setInterval` over text sections rather than producing sound. The library is 5
hand-written tabs. Motion/3D packages (`gsap`, `motion`, `lenis`, `three`,
`@react-three/*`) remain installed but unused, so they cost nothing until needed.
