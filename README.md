# GTabsTerm (TabsTerm)

Search a song, get its guitar tablature. Terminal-flavoured, no popups, no ad walls.

The UI implements the **TabsTerm** design from Claude Design (project
"TabsTerm – Plataforma de tabs", `TabsTerm.dc.html`): a text prompt with ghost-typing,
four themes (paper / crt / amber / mono) with CRT scanlines, slash commands,
keyboard-first navigation, and a tab view with a playback bar
(play / bpm / focus).

## Stack

| Layer         | Choice                                        | Why |
| ------------- | --------------------------------------------- | --- |
| Framework     | Next.js 16 (App Router, Turbopack)            | RSC, streaming, route handlers, typed routes |
| Runtime       | React 19.2 + React Compiler                   | Auto-memoization; no manual `useMemo` churn |
| Language      | TypeScript (strict, `noUncheckedIndexedAccess`) | |
| Styling       | Tailwind CSS v4 (`@theme` tokens)             | Tokens live in one file; restyling is a token edit |
| Data fetching | TanStack Query                                | Cache, dedupe, abort on the client |
| URL state     | nuqs                                          | `q` and `view` live in the URL — shareable |
| Theming       | next-themes                                   | `data-theme` on `<html>`: paper / crt / amber / mono |
| Validation    | Zod v4                                        | Env, API boundaries, upstream responses |
| Client state  | Zustand                                       | Mock account, modal state, and local drafts |
| Motion        | Motion (Framer) + GSAP + Lenis                | Layout/gesture animation, timelines, smooth scroll |
| 3D            | three + React Three Fiber + drei + postprocessing | Ready for an awwwards-grade WebGL layer |
| Lint / format | Biome                                         | One fast binary instead of ESLint + Prettier |
| Unit tests    | Vitest + Testing Library                      | |
| E2E           | Playwright                                    | |

> The 3D and motion packages are installed but not imported anywhere yet, so they add
> nothing to the bundle. Drop `three`, `@react-three/*` and `gsap` if the design pass
> ends up not needing them.

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run check        # typecheck + lint + unit tests
npm run test:e2e     # Playwright (boots its own dev server)
npm run lint:fix     # Biome autofix + import sorting
```

## Architecture

```
src/
  app/
    page.tsx                        the terminal (home / results screens)
    song/[provider]/[id]/page.tsx   tab view (server-fetched, no HTTP hop)
    api/search/route.ts             GET /api/search?q=
    api/tabs/route.ts               GET /api/tabs — the whole library
    api/tab/[provider]/[id]/route.ts
    globals.css                     theme tokens (--tt-*) + term-* utilities
  components/
    chrome/                         header, about/auth modals, theme cycle
    terminal/                       prompt, ghost typer, slash commands, screens
    tab/                            tab view, playback bar, section parser
  stores/                           zustand: session (mock user) + ui + drafts
  hooks/                            client data hooks
  lib/
    env, http, cn/slugify
    tabs/contract.ts                domain model + Zod schemas + TabProvider interface
  server/tabs/                      `server-only`; imports the contract, never the reverse
    registry.ts                     fan-out, dedupe, graceful degradation
    providers/
      local.ts                      tabs committed to this repo
  data/seed-tabs.ts                 the local library
```

### Keyboard

`enter` run · `tab` complete (`shift+tab` backwards) · `↑ ↓` / `j k` move ·
`esc` back · on a tab: `space` play · `f` focus ·
`t` theme (anywhere).

Slash commands: `/new`, `/list`, `/rand`, `/man`, `/theme`. None takes an argument —
typing anything that is not a command searches.

**The grid.** Every notation position is `CELL_WIDTH` characters wide (3), so `0--`, `12-` and
`---` all measure the same and a reader can count positions straight down a
column. One character per position — the usual convention — breaks above the
ninth fret: a two-digit fret either pushes everything after it out of line or
silently swallows the next time position. Two characters is enough to fix that,
but leaves a `12` touching the next one; the third keeps a dash after every fret.

`normaliseGrid` in `src/lib/tab/grid.ts` re-lays ragged tab onto the grid and is
idempotent. `regrid` is its dangerous sibling, for content written at a *known
different* width — changing `CELL_WIDTH` needs it for the shipped library
(`node scripts/normalise-seeds.ts --from 2`) and for drafts already in a browser
(a persist `version` bump in `src/stores/drafts.ts`). Reaching for `normaliseGrid`
there instead doubles the length of the piece, because it reads every character
column as a position.

**The editor edits cells, not characters.** `/new` draws each position as a
button you click and type a fret into (`tab-grid.tsx`, over the cell model in
`src/lib/tab/cells.ts`). Because a fret replaces a fixed-width cell rather than
being inserted into a line, a two-digit fret cannot push the strings below it out
of column — the alignment problem is gone by construction rather than corrected
after the fact. There is no raw text box.

Which is why every block has to be reachable from the grid itself: a section name
is an input, and each block — section, prose or stave — carries its own `remove`.
`parseTabNotes` gives every block a `firstLine` and `lineCount` for exactly this,
so an edit splices the lines it is already looking at instead of searching the
content for text that may appear twice.

**Guitar tablature only.** `tabTypeSchema` has a single member: no chord sheets,
no bass, no ukulele. It stays an enum so one of those can come back as an added
member rather than a field re-threaded through the schema, the editor and the
UI — and since a single value says nothing, it is not displayed anywhere.

**Tab completion** works the way a shell's does, and lives in
`src/components/terminal/completion.ts` as pure functions. `/ra` + Tab finishes to
`/rand`; repeated Tabs cycle the candidates and Shift+Tab walks back, so a bare
`/` walks the whole list. No command takes an argument, so there is no second
step — the shell's complete-the-word-then-complete-its-value behaviour left with
the last command that had a value, and returns with the next one that does.

**Which sources are searched is the operator's decision**, made once in
`TAB_PROVIDERS`. There is no reader-facing filter: `/api/search` still accepts
`?provider=`, and the registry can only *narrow* `TAB_PROVIDERS` with it — a
client must never be able to switch on a source the operator turned off — but
nothing in the UI sets it, so every search asks the same question.

**`/list`** shows the whole library on the results screen. It is the same screen
as a search, because the question behind the rows is the only difference: with
nothing in the prompt, everything matched. That also makes `/?view=results` a
shareable link to the library. Listing is not "search for an empty string" —
searching needs a minimum length so the first keystroke does not fire a request,
and listing has no query at all, so they are separate endpoints (`/api/tabs`) and
a separate optional `list()` on `TabProvider`.

**`/rand`** draws a tab from the sources that can enumerate their own catalog.
That is an optional `random()` on `TabProvider`: a search-only upstream simply
omits it and gets skipped, rather than having an id guessed for it. The pick
happens on the server behind the `/random` route, so it is also a
plain shareable link, and it redirects (307) to the chosen song. Narrowing to a
source that cannot be browsed renders an honest "nothing to draw from" page
instead of failing.

**The idle prompt shows the day's quote** (`$ fortune`), picked from
`src/data/quotes.ts` by UTC day. It is chosen on the server and the home page is
ISR with `revalidate = 3600`, so the quote is in the first byte of HTML, cannot
mismatch on hydration, and rotates daily.

### Tab sources

Sources implement one interface (`TabProvider` in `src/lib/tabs/contract.ts`) and are
enabled through the `TAB_PROVIDERS` env var. `searchAllProviders` queries them in
parallel with `Promise.allSettled`: a source that is down lands in `degraded` and the
UI says so, instead of the whole search failing.

- **`local`** — tablature committed to the repo (`src/data/seed-tabs.ts`). Always
  available, works offline, and is what the tests run against. Currently five
  traditional / public-domain pieces.

`local` is the only provider today. A Songsterr one existed and was removed; the
fan-out and `degraded` machinery is what survives of it, and it is not worth
adding to. See [docs/PLAN.md](docs/PLAN.md) — the product is a private workshop
now, so the content that matters is what each user writes, not what a source can
be persuaded to hand over.

To add a source: write `src/server/tabs/providers/<name>.ts`, register it in
`registry.ts`, add its id to `TAB_PROVIDERS`.

## Environment

Copy `.env.example` to `.env.local`. Every variable is parsed by Zod at boot
(`src/lib/env.ts`) — a bad value fails fast with a readable message.

## Design

The visual layer comes from the Claude Design project "TabsTerm – Plataforma de tabs".
When adjusting it:

- All theme values are the `--tt-*` variables at the top of `src/app/globals.css`
  (one block per theme). The `@theme inline` block maps them to `term-*` utilities —
  components only ever use those names.
- The mock auth modal is client-side only by design ("no login required to read
  anything"). Favorites were removed with the public catalogue: they only meant
- Do not put fetching or provider logic in components — it belongs in `src/server/tabs/`.
- `.tab-content` must keep `white-space: pre` and a monospace font. ASCII tablature is a
  fixed-width grid; if it reflows, it is wrong.
