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
  store). The registry and the providers are marked `server-only`
  and import it; never the reverse. Putting a database client, a secret, or a node
  builtin behind that import is what the `server-only` marks exist to catch.
- **ASCII tablature is a fixed-width grid.** `.tab-content` must keep `white-space: pre`
  and a monospace font with ligatures off. If it reflows, the tab is wrong.
- **Every notation position is `CELL_WIDTH` characters wide** (`src/lib/tab/grid.ts`,
  currently 3): `0--`, `12-` and `---` all measure the same. One character per position
  breaks the moment anyone plays above the ninth fret, because a two-digit fret either
  pushes the column out of line or silently eats the next time position. Two is enough
  for that but leaves `12` touching the next `12`; three keeps a dash after every fret.
- **Changing `CELL_WIDTH` is a migration, not a constant edit.** Three things follow it:
  `COLUMNS_PER_BEAT` (derived in `use-tab-playback.ts`) or every tab changes tempo,
  `src/data/seed-tabs.ts` via `node scripts/normalise-seeds.ts --from <old>`, and the
  drafts store's persist `version` plus a `regrid` migration for tabs already in
  someone's browser. Use `regrid`, never `normaliseGrid`, for that: `normaliseGrid`
  reads every *character* column as a position, so on already-gridded content it
  doubles the length of the piece.
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
- **Whether a tab plays is asked, never stored.** `isPlayable` in
  `src/lib/tab/parse-notes.ts` asks the parser whether it found notes, and the playback
  bar is the only thing that reports it. A stored `capability` field used to duplicate
  this and was removed: with the grid as the only way in, everything has a stave, so the
  badge said the same thing on every tab and its `link` value was reachable only for an
  empty tab — where it claimed the tab opened on another site.
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
  when the two disagree. There is no `align grid` button: writing a cell rewrites the
  whole stave at a fixed width, so touching a ragged stave anywhere squares it.
- **A written bar and a counted bar must be the same bar.** `blankStave` lays bar lines
  every `COLUMNS_PER_BAR` positions because the playback bar counts by that constant. It
  used to use eight of its own, so a stave showed two bars while the counter said one —
  and was half as wide as the page allowed. `+ stave` now fills the column at 980px.
- **Tablature never scrolls sideways, and that is enforced where staves are written.**
  `BARS_PER_STAVE` (`src/lib/tab/grid.ts`) is how wide a stave may be — two bars, 100
  characters, what a 980px column fits at 15px monospace. `blankStave` and `notesToAscii`
  both read it, `setCell` cannot widen a stave, and `src/data/seed-tabs.test.ts` pins the
  shipped library, so nothing in the product can produce a wider one. The reader does not
  wrap: wrapping would break bars to hide a layout mistake. Both reading columns are
  sized to the stave — do not narrow `max-w-[980px]` in `tab-view.tsx`, and do not give
  `.tab-content` letter-spacing, because the playback cursor is placed in `ch` and any
  tracking drifts it a character every thirty columns.
- **With no text box, anything not reachable from the grid is unreachable, full stop.**
  Every block carries a `remove`; each edit splices by `block.firstLine`/`lineCount`
  from `parseTabNotes`, never by searching the content — two blocks can hold the same
  words.
- **A blank line between staves is structure, not spacing.** A stave is a *run* of
  consecutive stave lines, so two staves written back to back are one twelve-string
  stave: it falls back to a six-string tuning, plays half of itself and cannot be
  removed separately. `appendBlock` (`src/lib/tab/edit.ts`) is why every path that grows
  a tab leaves the line, and `removeLines` (`src/lib/tab/cells.ts`) is why deleting the
  prose between two staves leaves a blank line behind instead of welding them.
- **There are no sections.** `[Intro]` is not punctuation the parser knows; a bracketed
  line reads as the prose it looks like. There is no `label` block kind, no `+ section`,
  and the transcriber's `take 1 · ~96 bpm` heading is a plain line. Prose blocks still
  exist — chord names above a stave are the point of them.
- **Transcribing is a way of starting a tab, not a place to go.** It lives as a control
  inside the `/new` editor, so what comes out lands in a draft that already has the
  title, tuning and capo fields it needs. There is no `/listen` route; a page of its own
  meant the result had to be teleported into an editor afterwards.
- **Autoscroll follows the cursor's stave, and that is the only thing it may watch.**
  `useFollowCursor` (`src/hooks/use-follow-cursor.ts`) keys on the id from
  `staveAtColumn`, so it fires exactly when the cursor crosses into a new stave. The
  effect it replaced depended on `playing`: it ran once, scrolled to the first stave and
  then let the cursor walk off the bottom of the window — autoscroll that only worked
  for the opening bar. It scrolls only when the stave is not already in view, because
  snapping every stave to the top jumps a page that had nothing wrong with it. Both the
  reader and the editor use it, and `staveAtColumn` is also what decides which stave
  *draws* the cursor — asked twice, the two answers drift and the page follows a stave
  the cursor is not on.
- **There is no focus mode.** No `f` key, no toggle on the playback bar, no wide
  variant of the reading column: it widened `max-w-[980px]` to 1100px, which is past
  what a stave measures, and hid the `open …` path for a screen that is already nothing
  but tablature. A second way to look at one screen has to earn itself.
- **There is one screen for opening a tab, and reading is where writing ends.**
  Publishing leaves the editor for `/song/mine/<id>` — the same `TabView` the catalog
  opens on — and that screen carries `[e] edit` back to `/new?id=<id>`. There is no
  `/draft/[id]` route and no draft screen: a second reading screen meant a tab you wrote
  looked different from a tab you read, for no reason a reader could name. `editHref` is
  what the two modes hang on, and a catalog tab has none — it is not yours to change.
- **`mine` is a provider id with no provider behind it** (`MINE_PROVIDER`, in
  `src/lib/tabs/contract.ts`). It exists so a tab in localStorage gets the same URL shape
  as one from the catalog, and `src/app/song/[provider]/[id]/page.tsx` branches on it to
  hand the read to the client instead of 404ing on a tab the browser holds perfectly
  well. It lives in the contract and not beside the store because a server component has
  to read it, and every export of a `"use client"` module reaches the server as a client
  reference rather than a value.
- **`published` is what makes a tab findable, and what the editor's action reads.**
  `publish` the first time, `update` every time after — taken from the draft as it
  arrived, so the word cannot change under someone mid-edit. Autosave has already stored
  the words either way; what the button really does is stop editing and open the tab.
  Because `edit` can now reach a tab that exists, the destructive control says `delete`
  there and `discard` on something never published.
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
- **`TabProvider.list` and `.random` are optional by design, and mean the same thing:**
  this source can enumerate its own catalog. A search-only upstream implements neither,
  and `listAllProviders` / `randomTab` leave it out rather than counting it as a source
  that answered with nothing.
- **Accounts are optional, and half-configured is an error.** `supabaseConfig`
  (`src/lib/supabase/config.ts`) is null when neither Supabase variable is set, and the
  app runs on localStorage exactly as it did before — which is how e2e runs and how a
  clone with no `.env.local` builds. One variable without the other throws: falling back
  there would run a deployment its operator believes has accounts, with everyone's tabs
  going into a browser. The pair lives outside `src/lib/env.ts` because the browser needs
  it and `env.ts` is server configuration.
- **Identity comes from `getClaims()`, never `getSession()`.** A session is read out of a
  cookie the browser wrote; only `getClaims()` verifies the signature before answering,
  and its `sub` is what may be used as `owner`. `currentAccount()` in
  `src/lib/supabase/server.ts` is the one place that decides this.
- **It is `src/proxy.ts`, not `middleware.ts`.** Next 16 deprecated that convention and
  errors if both exist; every Supabase guide still says middleware. The proxy exists to
  refresh the token *before* rendering — a Server Component cannot set cookies, so
  without it `serverSupabase`'s swallowed write turns into random logouts.
- **Reading is open; writing needs an account — where there is one to have.** `/new`
  shows `SignInToWrite` instead of the editor when Supabase is configured and nobody is
  signed in, because a tab written without an account has nowhere to be kept: it would
  sit in a browser, look saved, and vanish with the site data. The gate is conditional
  on `hasAccounts` on purpose. A build with no account server has none to ask for, and
  that is the configuration `npm run test:e2e` runs in — making the gate unconditional
  would delete the editor's entire test coverage, since Google's consent screen cannot
  be driven headlessly. `e2e/accounts.spec.ts` pins the gate and is skipped unless
  `E2E_ACCOUNTS=1`. Note the gate checks `user === null`, never falsy: `undefined` means
  the session is still being read, and turning people away during it would greet every
  signed-in writer with a sign-in screen.
- **`useLibrary` is where your tabs are, and no screen may know which store answered.**
  An account when signed in, this browser when not — both real, because the second is
  how the app worked before accounts and still works for anyone who never signs in.
  There is no merging: a session means the account is the truth, and local tabs move
  across once, in `AdoptLocalTabs`. Two live copies of one tab is the bug that avoids.
- **A hook that hands back a new function every render breaks any effect that keeps a
  timer.** `useLibrary`'s `save`, `remove` and `get` are `useCallback`ed for that reason
  and not as tidiness: the editor autosaves from an effect with `save` in its
  dependencies, and an unstable identity tore the timer down and restarted it before it
  could ever fire — so nothing was written at all. React Compiler does not save you here.
  For the same reason `NewTabScreen` resolves a tab once per id: every autosave
  refreshes the library, and re-resolving mid-edit swaps `published` under someone who
  is typing, which is what decides whether the button says publish or update.
- **Adoption confirms before it deletes.** `AdoptLocalTabs` uploads every local tab,
  *re-reads the account*, and only removes the local copy of what it finds there. A
  write that reports success but does not land would otherwise take the only copy with
  it. It is safe to run again because the tab keeps its id and `(owner, id)` is the
  primary key.
- **Signing in is one action, because there is one provider.** Google, and only Google.
  No email field, no password, no handle, and no login/signup pair — for someone who has
  never been here those are the same door. The handle is derived by
  `handle_new_user` from the email's local part, de-duplicated with a number, and read
  back out of `profiles` rather than guessed in the client: the second `tomas.v.girao` is
  `tomas.v.girao1`, and guessing shows them somebody else's name.
- **`SessionSync` is the only thing that writes `useSession`.** One subscription, in the
  layout, so a sign-in in another tab or an expiring token reaches the whole app. Two
  places asking Supabase who is signed in is two answers to one question. Its callback
  defers with `setTimeout(…, 0)` on purpose — calling back into the client from inside
  an `onAuthStateChange` notification can deadlock on the client's own lock.
- **E2E is pinned to the no-accounts configuration** (`playwright.config.ts` sets both
  Supabase variables empty). Whoever runs it may have `.env.local` configured, and the
  suite would otherwise test a different app than it does on a clean clone while reaching
  a real server. `E2E_ACCOUNTS=1` lets the real configuration through, on purpose;
  nothing committed depends on it, because Google's consent screen cannot be driven
  headlessly and a test that pretends otherwise only ever passes.
- **Row-level security is where the content rule is enforced, not the query.** One policy
  per table, both directions, `auth.uid() = owner`. "Nothing a user makes is visible to
  another user" holds even when a query forgets its filter — and a user's tabs must never
  become a `TabProvider`, because `searchAllProviders` fans out across providers and
  takes its `provider` from the client.
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
