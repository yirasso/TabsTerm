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
  (`src/lib/tabs/contract.ts`) and are registered in `src/server/tabs/registry.ts`.
  A new source is a new file in `providers/` plus an entry in `TAB_PROVIDERS`.
- **`src/lib/tabs/contract.ts` must stay safe to run in a browser.** It is the
  shared contract, imported as *values* by client code (response parsing, the drafts
  store, the badge labels). The registry and the providers are marked `server-only`
  and import it; never the reverse. Putting a database client, a secret, or a node
  builtin behind that import is what the `server-only` marks exist to catch.
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
- **A fret number is not a pitch.** Tab is written relative to the capo, so anything that
  sounds a note must add `capo` to the open string — `parseTabNotes(content, tuning, capo)`
  does this, and every caller has to pass it or the whole piece plays in the wrong key.
  Transcription runs `detectCapo` *before* `assignFrets` for the same reason: the capo
  decides which neck the notes are being placed on.
- **`searchAllProviders` may only narrow `TAB_PROVIDERS`, never widen it.** The
  `provider` query param is a client-supplied filter; treating it as a way to enable a
  source would let anyone switch on what the operator turned off. There is an e2e test
  pinning this.
- **Capability is decided in one place**, `deriveCapability` in `src/lib/tabs/contract.ts`.
  It asks the parser whether it found notes, so `full` cannot promise sound the player
  cannot deliver.
- **Guitar tablature only.** No chord sheets, bass or ukulele. `tabTypeSchema` keeps a
  single member so one can come back cheaply, but nothing displays it.
- **Audio analysis is one path, and it produces tabs.** `transcribeAudio`
  (`src/lib/audio/transcribe.ts`) runs Basic Pitch over a recording of one instrument.
  There is no chord-detection path — that was removed along with essentia.js.
- **Tabs are written through the grid, not typed as text.** `/new` renders every
  position as a clickable cell (`src/components/editor/tab-grid.tsx`) over the cell model
  in `src/lib/tab/cells.ts`; there is no textarea. Editing through cells is what makes
  alignment impossible to break — a fret replaces a fixed-width cell instead of pushing
  the line sideways — so do not add a raw text box back without deciding what happens
  when the two disagree. `align grid` stays for content that arrives ragged from
  elsewhere.
- **Transcribing is a way of starting a tab, not a place to go.** It lives as a control
  inside the `/new` editor, so what comes out lands in a draft that already has the
  title, tuning and capo fields it needs. There is no `/listen` route; a page of its own
  meant the result had to be teleported into an editor afterwards.
- **There is no reader-facing source filter.** `/api/search` still takes `?provider=`
  and `searchAllProviders` still honours it, but nothing in the UI sets one — which
  sources are searched is decided once, by the operator, in `TAB_PROVIDERS`. The `/src`
  command and `src/stores/prefs.ts` are gone; a filter with no indicator in the header
  silently haunted the reader, and an indicator was not worth the header space.
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
  deterministic and offline. Songsterr is gone; `local` is the only provider today.

## Content — the rule that decides everything

**Nothing a user makes is ever published, and adding publishing reopens the whole
copyright question.** Every tab belongs to the account that made it and is visible to
nobody else. That is what lets someone transcribe a recording they own: it is personal
use, not distribution. The moment one user can show another a tab — sharing, a public
link, a feed, an export someone else receives — publishing a transcription of a
protected work becomes the same thing as copying it, and that is a deliberate product
decision, never a convenience slipped into a PR.

Two things this does not relax. **Never scrape another site's tablature**, private or
not; copying someone's database is wrong on its own terms. And **audio never leaves the
browser** — analysis runs client-side on audio the user supplies, only the resulting
tab is stored, and the server never fetches or holds a recording (DMCA §1201 makes a
server-side YouTube-to-MP3 path a non-starter).

The five shipped tabs in `src/data/seed-tabs.ts` are product content, public domain with
provenance — not user tabs.

## Current state

The UI implements the TabsTerm design imported from Claude Design ("TabsTerm –
Plataforma de tabs", `TabsTerm.dc.html`): terminal prompt with ghost-typing, results
screen, tab view with playback bar, about/auth modals, keyboard-first.

What is still fake and scheduled to become real (see the plan): the auth modal is a
client-side mock and tabs live in localStorage rather than an account. The library is
5 shipped public-domain tabs. Motion/3D packages (`gsap`, `motion`, `lenis`, `three`,
`@react-three/*`) remain installed but unused, so they cost nothing until needed.
