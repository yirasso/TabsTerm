"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandLine } from "@/components/chrome/command-line";
import { useThemeCycle } from "@/components/chrome/use-theme-cycle";
import type { Quote } from "@/data/quotes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSongSearch } from "@/hooks/use-song-search";
import type { SongSummary } from "@/lib/tabs/contract";
import { slugify } from "@/lib/utils";
import { DRAFT_PROVIDER, draftToSummary, useDrafts } from "@/stores/drafts";
import { useSession } from "@/stores/session";
import { anyModalOpen, useUi } from "@/stores/ui";
import { COMMANDS, LEAVES_PROMPT, parseCommand, searchTermFor } from "./commands";
import { type CycleState, nextCompletion } from "./completion";
import { useGhostTyper } from "./use-ghost-typer";

const INTRO = `tabsterm — guitar tablature behind a text prompt.
no ads, no scroll-jacked lyrics, no login. type a song, get the tab.`;

type Screen = "home" | "results";

/** An empty library is a beginning, not a failed search. */
const EMPTY_LIBRARY = `nothing in the library yet.

  · write one with /new — by hand, or from a recording
  · the shipped examples should be here too; if they are not, no source is enabled`;

function noResultsText(term: string) {
  return `no match in index for "${term}"

  · check the spelling, or drop the artist name
  · nothing here is scraped, so the library is only what has been written
  · try: greensleeves · scarborough fair · ode to joy · amazing grace
  · or write it yourself with /new`;
}

export function TerminalApp({ quote }: { quote?: Quote }) {
  const router = useRouter();
  const [query, setQuery] = useQueryState("q", { defaultValue: "", shallow: true });
  const [view, setView] = useQueryState("view", { shallow: true });
  const screen: Screen = view === "results" ? "results" : "home";

  const [sel, setSel] = useState(0);
  const [selMoved, setSelMoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cycleRef = useRef<CycleState>(null);

  const { openAbout } = useUi();
  const user = useSession((s) => s.user);
  const { cycle } = useThemeCycle();

  const debounced = useDebouncedValue(query, 250);
  const term = searchTermFor(debounced);

  // The results screen with nothing in the prompt is the whole library, which is
  // what `/list` navigates to. Same screen, same rows — the question behind them
  // is "everything" rather than "what matched".
  const listing = screen === "results" && !term;
  const { data, isFetching } = useSongSearch(term, { all: listing });

  const isCmd = query.trim().startsWith("/");

  // Drafts are in localStorage, so the server knows nothing about them. Merge
  // them in here, ahead of the catalog — someone looking for a tab they just
  // wrote should find it first.
  const drafts = useDrafts((s) => s.drafts);
  const draftHits = useMemo(() => {
    const published = Object.values(drafts).filter((d) => d.published);
    if (listing) return published.map(draftToSummary);

    const needle = slugify(term);
    if (!needle) return [];
    return published
      .filter((d) => slugify(`${d.title} ${d.artist}`).includes(needle))
      .map(draftToSummary);
  }, [drafts, term, listing]);

  const filteredResults = useMemo(
    () => [...draftHits, ...(data?.results ?? [])],
    [draftHits, data],
  );
  const degraded = data?.degraded ?? [];

  // What the area under the prompt shows: the day's quote when nothing is
  // typed, commands while typing a slash command, live search hits otherwise.
  const trimmed = query.trim().toLowerCase();
  const showQuote = !trimmed;
  const showCommands = !showQuote && isCmd;
  const commandSuggestions = COMMANDS.filter(
    (c) => trimmed === "/" || c.name.startsWith(trimmed.split(" ")[0] ?? ""),
  );
  const songSuggestions = filteredResults.slice(0, 6);
  const listLength = showCommands
    ? commandSuggestions.length
    : showQuote
      ? 0
      : songSuggestions.length;

  const songHref = (s: Pick<SongSummary, "provider" | "id">, from: Screen) => {
    // Drafts live in this browser, so they get a client-rendered route of their
    // own rather than one the server would fail to resolve.
    if (s.provider === DRAFT_PROVIDER) return `/draft/${encodeURIComponent(s.id)}` as Route;

    const qs = new URLSearchParams();
    if (query) qs.set("q", query);
    if (from !== "home") qs.set("view", from);
    const suffix = qs.size ? `?${qs.toString()}` : "";
    return `/song/${s.provider}/${encodeURIComponent(s.id)}${suffix}` as Route;
  };
  const openSong = (s: Pick<SongSummary, "provider" | "id">, from: Screen) =>
    router.push(songHref(s, from));

  const goHome = () => {
    setView(null);
    setSel(0);
    setSelMoved(false);
  };

  const runCommand = (raw: string) => {
    const c = parseCommand(raw);
    if (!c) return;
    if (c.cmd === "/theme") return cycle();
    if (c.cmd === "/man") return openAbout();
    // The command is `/rand`; `/random` is the route it opens. They are allowed
    // to differ — the URL is shareable and reads better spelled out.
    if (c.cmd === "/rand") return router.push("/random" as Route);
    if (c.cmd === "/new") return router.push("/new" as Route);
    if (c.cmd === "/list") {
      // Stays in the app rather than routing, so `setQuery("")` in pickCommand
      // is safe here and is in fact what puts the screen into listing mode.
      setView("results");
      setSel(0);
      setSelMoved(false);
    }
  };

  const pickCommand = (name: string) => {
    if (!LEAVES_PROMPT.has(name)) setQuery("");
    runCommand(name);
  };

  const submit = () => {
    if (!query.trim()) return;
    if (isCmd) {
      const pick = commandSuggestions[sel];
      if (pick) pickCommand(pick.name);
      else runCommand(query);
      return;
    }
    const pick = songSuggestions[sel];
    if (pick && selMoved) return openSong(pick, "home");
    if (songSuggestions.length === 1 && songSuggestions[0])
      return openSong(songSuggestions[0], "home");
    setView("results");
    setSel(0);
    setSelMoved(false);
  };

  // Focus the prompt whenever the home screen comes up.
  useEffect(() => {
    if (screen !== "home") return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [screen]);

  // Keep the selection inside the current list.
  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, listLength - 1)));
  }, [listLength]);

  // Screen-level keys. Re-registered per render so closures stay fresh; modal
  // Escape handlers run in the capture phase and never reach this.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyModalOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        if (screen !== "home") goHome();
        return;
      }
      if (screen === "home") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSel((s) => Math.min(listLength - 1, s + 1));
          setSelMoved(true);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSel((s) => Math.max(0, s - 1));
          setSelMoved(true);
        }
        return;
      }
      const rows = filteredResults;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSel((s) => Math.min(rows.length - 1, s + 1));
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSel((s) => Math.max(0, s - 1));
      }
      if (e.key === "Enter") {
        const r = rows[sel];
        if (r) openSong(r, screen);
      }
      if (e.key === "t") cycle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ghost = useGhostTyper(screen === "home" && !query);
  // No trailing `$` — the prompt line below carries it, at the size that counts,
  // and two of them reads like a stutter.
  const promptLabel = `${user?.handle ?? "user"}@tabsterm:~`;

  const onPromptKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      // Tab belongs to the prompt here, not to focus navigation.
      e.preventDefault();
      const step = nextCompletion(query, cycleRef.current, e.shiftKey ? -1 : 1);
      if (!step) return;
      cycleRef.current = step.state;
      setQuery(step.value);
      setSel(0);
      setSelMoved(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setSel((s) => Math.min(listLength - 1, Math.max(0, s + dir)));
      setSelMoved(true);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  if (screen === "home") {
    return (
      <main className="mx-auto max-w-[820px] px-[22px] pb-20 pt-[14vh]">
        <pre className="mb-1.5 whitespace-pre-wrap text-[12px] text-term-dim">{INTRO}</pre>
        <div className="h-11" aria-hidden />

        {/* The prompt is what this screen is for, so it gets the display step
            and the machine name drops to a size that introduces it rather than
            competing with it. */}
        <label htmlFor="prompt" className="block cursor-text border-b-2 border-term-fg pb-3">
          <span className="mb-1 block text-[11px] text-term-faint">{promptLabel}</span>
          <span className="tt-display flex items-baseline gap-[0.4em]">
            <span className="flex-none text-term-accent">$</span>
            <span className="relative min-w-0 flex-1">
              <input
                id="prompt"
                ref={inputRef}
                aria-label="search for a song"
                value={query}
                onChange={(e) => {
                  // Typing anything abandons the completion cycle.
                  cycleRef.current = null;
                  setQuery(e.target.value);
                  setSel(0);
                  setSelMoved(false);
                }}
                onKeyDown={onPromptKey}
                spellCheck={false}
                autoComplete="off"
                className="w-full border-0 bg-transparent p-0 text-[length:inherit] leading-[inherit] tracking-[inherit] caret-term-accent outline-none"
              />
              {!query && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-0 left-0 truncate text-term-faint"
                >
                  {ghost}
                </span>
              )}
            </span>
            {!query && (
              <span
                aria-hidden
                className="tt-cursor h-[0.78em] w-[0.5em] flex-none translate-y-[0.06em] bg-term-accent"
              />
            )}
          </span>
        </label>

        <div className="mt-[18px] min-h-[200px]">
          {showQuote && quote && <DailyQuote quote={quote} />}

          {showCommands &&
            commandSuggestions.map((c, i) => (
              <SuggestionRow
                key={c.name}
                on={i === sel}
                idx={i}
                title={c.name}
                sub={c.hint}
                tag="cmd"
                onPick={() => pickCommand(c.name)}
              />
            ))}

          {!showQuote &&
            !showCommands &&
            songSuggestions.map((s, i) => (
              <SuggestionRow
                key={`${s.provider}:${s.id}`}
                on={i === sel}
                idx={i}
                title={s.title}
                sub={`· ${s.artist}`}
                tag=""
                onPick={() => openSong(s, "home")}
              />
            ))}

          {!showQuote && !showCommands && (
            <>
              {isFetching && songSuggestions.length === 0 && (
                <div className="py-[5px] text-term-faint">searching…</div>
              )}
              {!isFetching && term.length >= 2 && songSuggestions.length === 0 && (
                <div className="py-[5px] text-term-dim">
                  no match for “{term}” — <span className="text-term-fg">enter</span> for details →
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-14 flex flex-nowrap gap-x-[26px] gap-y-1.5 overflow-x-auto border-t border-term-line pt-3.5 text-[11px] text-term-faint">
          <span className="flex-none whitespace-nowrap">
            <span className="text-term-dim">enter</span> · run
          </span>
          <span className="flex-none whitespace-nowrap">
            <span className="text-term-dim">↑ ↓</span> · move selection
          </span>
          <span className="flex-none whitespace-nowrap">
            <span className="text-term-dim">tab</span> · complete
          </span>
          <span className="flex-none whitespace-nowrap">
            <span className="text-term-dim">/</span> · commands
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[900px] px-[22px] pb-20 pt-[34px]">
      <CommandLine display>{listing ? "list --all" : `find “${term}”`}</CommandLine>
      <div className="mt-2 text-[11px] text-term-faint">
        {isFetching && filteredResults.length === 0
          ? "reading the library…"
          : `${filteredResults.length} ${listing ? "tabs" : "results"}`}
      </div>
      {degraded.map((d) => (
        <div key={d.provider} className="text-[11px] text-term-accent">
          warn: {d.provider} unavailable — partial results
        </div>
      ))}
      <div className="mb-6" aria-hidden />

      {filteredResults.map((r, i) => (
        <Link
          key={`${r.provider}:${r.id}`}
          href={songHref(r, "results")}
          className={`grid grid-cols-[22px_1fr] items-baseline gap-3.5 border-b border-term-line py-2 pl-1 pr-2 text-term-fg ${i === sel ? "tt-selected" : ""}`}
        >
          <span className="text-term-accent">{i === sel ? "›" : " "}</span>
          <span>
            <span className="font-medium">{r.title}</span>{" "}
            <span className="text-term-dim">· {r.artist}</span>
          </span>
        </Link>
      ))}

      {!isFetching && filteredResults.length === 0 && (
        <>
          <pre className="whitespace-pre-wrap text-[13px] leading-[1.9] text-term-dim">
            {listing ? EMPTY_LIBRARY : noResultsText(term)}
          </pre>
          <button
            type="button"
            onClick={goHome}
            className="mt-[22px] inline-block whitespace-nowrap border border-term-line px-3 py-[7px] text-[12px] hover:border-term-accent hover:text-term-accent"
          >
            [esc] back to the prompt
          </button>
        </>
      )}

      {filteredResults.length > 0 && (
        <div className="mt-[26px] text-[11px] text-term-faint">
          <span className="text-term-dim">↑ ↓</span> move ·{" "}
          <span className="text-term-dim">enter</span> open ·{" "}
          <span className="text-term-dim">esc</span> back
        </div>
      )}
    </main>
  );
}

/** The idle prompt's fortune: one quote, the same for everyone, all day. */
function DailyQuote({ quote }: { quote: Quote }) {
  return (
    <div className="py-[5px]">
      <div className="text-[11px] text-term-faint">
        <span className="text-term-accent">$</span> fortune
      </div>
      {/* The accent carries the quotation marks rather than a rule down the
          side; the prompt above owns the loud move on this screen and the
          fortune should read like something worth stopping for, not an alert. */}
      <blockquote className="mt-3 max-w-[68ch]">
        <p className="text-[16px] text-term-fg leading-[1.55]">
          <span className="text-term-accent">“</span>
          {quote.text}
          <span className="text-term-accent">”</span>
        </p>
        <footer className="mt-2 text-[11px] text-term-faint">— {quote.author}</footer>
      </blockquote>
    </div>
  );
}

function SuggestionRow(props: {
  on: boolean;
  idx: number;
  title: string;
  sub: string;
  tag: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onPick}
      className={`flex w-full items-baseline gap-3 py-[7px] pl-1 text-left ${props.on ? "tt-selected text-term-fg" : "text-term-dim hover:text-term-fg"}`}
    >
      <span className="w-3.5 flex-none text-term-accent">{props.on ? "›" : " "}</span>
      <span className="w-[26px] flex-none text-[11px] text-term-faint">
        {String(props.idx + 1).padStart(2, "0")}
      </span>
      <span className="font-medium">{props.title}</span>
      <span className="text-[12px] text-term-dim">{props.sub}</span>
      <span className="flex-1" />
      <span className="flex-none whitespace-nowrap text-[11px] text-term-faint">{props.tag}</span>
    </button>
  );
}
