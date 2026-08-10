# GTabsTerm (TabsTerm)

Search a song, get its guitar tablature. Terminal-flavoured, no popups, no ad walls.

The UI implements the **TabsTerm** design from Claude Design (project
"TabsTerm – Plataforma de tabs", `TabsTerm.dc.html`): a text prompt with ghost-typing,
four themes (paper / crt / amber / mono) with CRT scanlines, slash commands, a ⌘K
palette, keyboard-first navigation, and a tab view with a playback bar
(play / bpm / autoscroll / focus / favorite).

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
| Client state  | Zustand                                       | Session favorites + mock account + modal state |
| Motion        | Motion (Framer) + GSAP + Lenis                | Layout/gesture animation, timelines, smooth scroll |
| 3D            | three + React Three Fiber + drei + postprocessing | Ready for an awwwards-grade WebGL layer |
| Command UI    | cmdk                                          | For a ⌘K palette over the search |
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
    page.tsx                        the terminal (home / results / favs screens)
    song/[provider]/[id]/page.tsx   tab view (server-fetched, no HTTP hop)
    api/search/route.ts             GET /api/search?q=
    api/tab/[provider]/[id]/route.ts
    globals.css                     theme tokens (--tt-*) + term-* utilities
  components/
    chrome/                         header, about/auth modals, ⌘K palette, theme cycle
    terminal/                       prompt, ghost typer, slash commands, screens
    tab/                            tab view, playback bar, section parser
  stores/                           zustand: session (favs, mock user) + ui (modals)
  hooks/                            client data hooks
  lib/                              env, http, cn/slugify
  server/tabs/
    types.ts                        domain model + Zod schemas + TabProvider interface
    registry.ts                     fan-out, dedupe, graceful degradation
    providers/
      local.ts                      tabs committed to this repo
      songsterr.ts                  Songsterr public JSON API
  data/seed-tabs.ts                 the local library
```

### Keyboard

`enter` run · `↑ ↓` / `j k` move · `esc` back · `⌘K` palette · on a tab:
`space` play · `f` focus · `a` autoscroll · `s` favorite · `t` theme (anywhere).
Slash commands: `/tab`, `/chords`, `/artist`, `/fav`, `/login`, `/man`, `/theme`.

### Tab sources

Sources implement one interface (`TabProvider` in `src/server/tabs/types.ts`) and are
enabled through the `TAB_PROVIDERS` env var. `searchAllProviders` queries them in
parallel with `Promise.allSettled`: a source that is down lands in `degraded` and the
UI says so, instead of the whole search failing.

- **`local`** — tablature committed to the repo (`src/data/seed-tabs.ts`). Always
  available, works offline, and is what the tests run against. Currently five
  traditional / public-domain pieces.
- **`songsterr`** — `https://www.songsterr.com/api/songs?pattern=…`. Undocumented but
  public and unauthenticated. **Metadata only**: Songsterr's tablature lives in their
  player, so these results carry `externalOnly: true` and link out. Responses are
  cached for an hour.

**Open decision:** there is no free, licensed API that returns full tablature text.
Ultimate Guitar has no public API and scraping it breaks their terms. So the real
content options are (a) grow the `local` library, (b) accept user submissions, or
(c) license a source. The provider interface exists so that choice can be made later
without touching the UI.

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
  anything"); favorites are in-memory on purpose ("favorites live in this session only").
- Do not put fetching or provider logic in components — it belongs in `src/server/tabs/`.
- `.tab-content` must keep `white-space: pre` and a monospace font. ASCII tablature is a
  fixed-width grid; if it reflows, it is wrong.
