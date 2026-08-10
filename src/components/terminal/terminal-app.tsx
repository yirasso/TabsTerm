"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { useThemeCycle } from "@/components/chrome/use-theme-cycle";
import { CapabilityBadge } from "@/components/tab/capability-badge";
import type { Quote } from "@/data/quotes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSongSearch } from "@/hooks/use-song-search";
import { CAPABILITY_LABEL, type SongSummary } from "@/server/tabs/types";
import { usePrefs } from "@/stores/prefs";
import { type FavEntry, useSession } from "@/stores/session";
import { anyModalOpen, useUi } from "@/stores/ui";
import { COMMANDS, parseCommand, searchTermFor } from "./commands";
import { type CycleState, nextCompletion, SOURCE_ALL } from "./completion";
import { useGhostTyper } from "./use-ghost-typer";

const INTRO = `tabsterm — guitar tablature behind a text prompt.
no ads, no scroll-jacked lyrics, no login. type a song, get the tab.`;

type Screen = "home" | "results" | "favs";

function noResultsText(term: string) {
  return `no match in index for "${term}"

  · check the spelling, or drop the artist name
  · sources: the in-repo library and songsterr
  · try one of: greensleeves · scarborough fair · ode to joy · house of the rising sun`;
}

export function TerminalApp({ providers = [], quote }: { providers?: string[]; quote?: Quote }) {
  const router = useRouter();
  const [query, setQuery] = useQueryState("q", { defaultValue: "", shallow: true });
  const [view, setView] = useQueryState("view", { shallow: true });
  const screen: Screen = view === "results" ? "results" : view === "favs" ? "favs" : "home";

  const [sel, setSel] = useState(0);
  const [selMoved, setSelMoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cycleRef = useRef<CycleState>(null);

  const { openAbout, openAuth } = useUi();
  const promptFocusTick = useUi((s) => s.promptFocusTick);
  const user = useSession((s) => s.user);
  const favs = useSession((s) => s.favs);
  const toggleFav = useSession((s) => s.toggleFav);
  const { cycle } = useThemeCycle();
  const provider = usePrefs((s) => s.provider);
  const setProvider = usePrefs((s) => s.setProvider);

  const debounced = useDebouncedValue(query, 250);
  const term = searchTermFor(debounced);
  const { data, isFetching } = useSongSearch(term);

  const cmd = parseCommand(query);
  const isCmd = query.trim().startsWith("/");

  const filteredResults = data?.results ?? [];
  const degraded = data?.degraded ?? [];

  // What the area under the prompt shows: the day's quote when nothing is
  // typed, source values while completing /src, commands while typing a slash
  // command, live search hits otherwise.
  const trimmed = query.trim().toLowerCase();
  const sourceOptions =
    cmd?.cmd === "/src"
      ? [SOURCE_ALL, ...providers].filter((p) => p.startsWith(cmd.arg.toLowerCase()))
      : [];
  const showQuote = !trimmed;
  const showSources = !showQuote && sourceOptions.length > 0;
  const showCommands = !showQuote && !showSources && isCmd;
  const commandSuggestions = COMMANDS.filter(
    (c) => trimmed === "/" || c.name.startsWith(trimmed.split(" ")[0] ?? ""),
  );
  const songSuggestions = filteredResults.slice(0, 6);
  const listLength = showSources
    ? sourceOptions.length
    : showCommands
      ? commandSuggestions.length
      : showQuote
        ? 0
        : songSuggestions.length;

  const applySource = (value: string) => {
    setProvider(value === SOURCE_ALL ? null : value);
    setQuery("");
    setSel(0);
    setSelMoved(false);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const songHref = (s: Pick<SongSummary, "provider" | "id">, from: Screen) => {
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
    if (c.cmd === "/fav") {
      setView("favs");
      setSel(0);
      return;
    }
    if (c.cmd === "/theme") return cycle();
    if (c.cmd === "/auth") return openAuth();
    if (c.cmd === "/man") return openAbout();
    if (c.cmd === "/src") {
      const wanted = c.arg.toLowerCase();
      if (wanted === SOURCE_ALL) return applySource(SOURCE_ALL);
      if (providers.includes(wanted)) return applySource(wanted);
      return;
    }
    if (["/tab", "/artist"].includes(c.cmd) && c.arg) {
      setView("results");
      setSel(0);
      setSelMoved(false);
    }
  };

  const pickCommand = (name: string) => {
    if (name.includes("<")) {
      setQuery(`${name.split(" ")[0]} `);
      setSel(0);
      setSelMoved(false);
      setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }
    setQuery("");
    runCommand(name);
  };

  const submit = () => {
    if (!query.trim()) return;
    if (showSources) {
      const pick = sourceOptions[sel];
      if (pick) applySource(pick);
      return;
    }
    if (isCmd) {
      const pick = commandSuggestions[sel];
      if (cmd?.arg || !pick) runCommand(query);
      else pickCommand(pick.name);
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

  // Focus the prompt on home, and again whenever something asks for it.
  useEffect(() => {
    if (screen !== "home") return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [screen, promptFocusTick]);

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
      const rows: (SongSummary | FavEntry)[] = screen === "results" ? filteredResults : favs;
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
  const promptLabel = `${user?.handle ?? "user"}@tabsterm:~$`;

  const onPromptKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      // Tab belongs to the prompt here, not to focus navigation.
      e.preventDefault();
      const step = nextCompletion(query, cycleRef.current, e.shiftKey ? -1 : 1, {
        providers,
        songs: songSuggestions.map((s) => s.title),
      });
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

        <label
          htmlFor="prompt"
          className="flex cursor-text items-baseline gap-2.5 border-b border-term-fg pb-2.5"
        >
          <span className="whitespace-nowrap text-[15px] text-term-accent">{promptLabel}</span>
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
              className="w-full border-0 bg-transparent p-0 text-[15px] caret-term-accent outline-none"
            />
            {!query && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 text-[15px] text-term-faint"
              >
                {ghost}
              </span>
            )}
          </span>
          {!query && (
            <span aria-hidden className="tt-cursor h-[17px] w-2 flex-none bg-term-accent" />
          )}
        </label>

        <div className="mt-[18px] min-h-[200px]">
          {showQuote && quote && <DailyQuote quote={quote} />}

          {showSources &&
            sourceOptions.map((p, i) => (
              <SuggestionRow
                key={p}
                on={i === sel}
                idx={i}
                title={p}
                sub={p === SOURCE_ALL ? "every enabled source" : "this source only"}
                tag={(provider ?? SOURCE_ALL) === p ? "active" : "src"}
                onPick={() => applySource(p)}
              />
            ))}

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
            !showSources &&
            !showCommands &&
            songSuggestions.map((s, i) => (
              <SuggestionRow
                key={`${s.provider}:${s.id}`}
                on={i === sel}
                idx={i}
                title={s.title}
                sub={`· ${s.artist}`}
                tag={`${CAPABILITY_LABEL[s.capability]} · ${s.provider}`}
                onPick={() => openSong(s, "home")}
              />
            ))}

          {!showQuote && !showSources && !showCommands && (
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
          <span className="flex-none whitespace-nowrap">
            <span className="text-term-dim">⌘K</span> · palette
          </span>
        </div>
      </main>
    );
  }

  if (screen === "results") {
    // Which sources actually answered, so a narrowed search is visible here
    // now that the header carries no indicator.
    const sourcesUsed = [...new Set(filteredResults.map((r) => r.provider))];
    return (
      <main className="mx-auto max-w-[900px] px-[22px] pb-20 pt-[34px]">
        <div className="text-term-dim">
          <span className="text-term-accent">$</span> find “{term}”
          {provider ? ` --src ${provider}` : ""}
        </div>
        <div className="text-[11px] text-term-faint">
          {isFetching && filteredResults.length === 0
            ? "querying sources…"
            : `${filteredResults.length} results · sources: ${sourcesUsed.join(", ") || "none"}`}
        </div>
        {degraded.map((d) => (
          <div key={d.provider} className="text-[11px] text-term-accent">
            warn: {d.provider} unavailable — partial results
          </div>
        ))}
        <div className="mb-5" aria-hidden />

        {filteredResults.map((r, i) => (
          <Link
            key={`${r.provider}:${r.id}`}
            href={songHref(r, "results")}
            className={`grid grid-cols-[22px_1fr_110px_70px_100px] items-baseline gap-3.5 border-b border-term-line py-2 pl-1 pr-2 text-term-fg ${i === sel ? "tt-selected" : ""}`}
          >
            <span className="text-term-accent">{i === sel ? "›" : " "}</span>
            <span>
              <span className="font-medium">{r.title}</span>{" "}
              <span className="text-term-dim">· {r.artist}</span>
            </span>
            <span className="whitespace-nowrap text-[12px] text-term-dim">{r.type}</span>
            <span className="text-[12px]">
              <CapabilityBadge capability={r.capability} />
            </span>
            <span className="whitespace-nowrap text-right text-[11px] text-term-faint">
              {r.provider}
            </span>
          </Link>
        ))}

        {!isFetching && filteredResults.length === 0 && (
          <>
            <pre className="whitespace-pre-wrap text-[13px] leading-[1.9] text-term-dim">
              {noResultsText(term)}
            </pre>
            <button
              type="button"
              onClick={goHome}
              className="mt-[22px] inline-block whitespace-nowrap border border-term-line px-3 py-[7px] text-[12px] hover:border-term-accent hover:text-term-accent"
            >
              [esc] new search
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

  // favs
  return (
    <main className="mx-auto max-w-[900px] px-[22px] pb-20 pt-[34px]">
      <div className="text-term-dim">
        <span className="text-term-accent">$</span> fav --list
      </div>
      <div className="text-[11px] text-term-faint">
        {favs.length} favorited · local to this session
      </div>
      <div className="mb-5" aria-hidden />

      {favs.map((f, i) => (
        <div
          key={`${f.provider}:${f.id}`}
          className={`grid grid-cols-[22px_1fr_110px_70px_100px_60px] items-baseline gap-3.5 border-b border-term-line py-2 pl-1 pr-2 ${i === sel ? "tt-selected" : ""}`}
        >
          <span className="text-term-accent">{i === sel ? "›" : " "}</span>
          <Link href={songHref(f, "favs")} className="text-term-fg">
            <span className="font-medium">{f.title}</span>{" "}
            <span className="text-term-dim">· {f.artist}</span>
          </Link>
          <span className="whitespace-nowrap text-[12px] text-term-dim">{f.type}</span>
          <span className="text-[12px]">
            <CapabilityBadge capability={f.capability} />
          </span>
          <span className="whitespace-nowrap text-[11px] text-term-faint">{f.provider}</span>
          <button
            type="button"
            onClick={() => toggleFav(f)}
            className="whitespace-nowrap text-right text-[11px] text-term-faint hover:text-term-accent"
          >
            unfav
          </button>
        </div>
      ))}

      {favs.length === 0 && (
        <pre className="whitespace-pre-wrap text-[13px] leading-[1.9] text-term-dim">{`no favorites yet.

  · open any tab and hit [s] to favorite it
  · favorites live in this session only`}</pre>
      )}

      {favs.length > 0 && (
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
      <blockquote className="mt-2.5 border-term-accent border-l-2 pl-3.5">
        <p className="text-[14px] leading-[1.6]">“{quote.text}”</p>
        <footer className="mt-1.5 text-[11px] text-term-faint">— {quote.author}</footer>
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
      className={`flex w-full items-baseline gap-3 py-[5px] text-left ${props.on ? "text-term-fg" : "text-term-dim"}`}
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
