"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CommandLine } from "@/components/chrome/command-line";
import { useThemeCycle } from "@/components/chrome/use-theme-cycle";
import { useFollowCursor } from "@/hooks/use-follow-cursor";
import { useTabPlayback } from "@/hooks/use-tab-playback";
import type { Tab } from "@/lib/tabs/contract";
import { anyModalOpen } from "@/stores/ui";
import { PlaybackBar } from "./playback-bar";
import { TabRender } from "./tab-render";

export function TabView({
  tab,
  backHref,
  editHref,
}: {
  tab: Tab;
  backHref: Route;
  /**
   * Where writing this one continues. Only a tab of your own has one — a
   * catalog tab is not yours to change — and it is what makes reading and
   * writing two modes of the same tab rather than two destinations.
   */
  editHref?: Route;
}) {
  const router = useRouter();
  const { cycle } = useThemeCycle();

  const { parsed, playable, playing, bpm, column, toggle, stop, setBpm } = useTabPlayback(
    tab.content,
    tab.tuning,
    tab.capo ?? 0,
  );

  const activeStaveRef = useFollowCursor(parsed.blocks, playing ? column : -1);

  // Both of these leave the page, and leaving has to silence the guitar: the
  // audio graph outlives the component that started it.
  const back = () => {
    stop();
    router.push(backHref);
  };

  const edit = () => {
    if (!editHref) return;
    stop();
    router.push(editHref);
  };

  // space play · e edit · t theme · esc back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyModalOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") return back();
      if (e.key === " ") {
        if (playable) {
          e.preventDefault();
          toggle();
        }
        return;
      }
      if (e.key === "e" && editHref) return edit();
      if (e.key === "t") cycle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // How to play it, and nothing about where it came from: every tab here is the
  // reader's own.
  const metaBits = [
    tab.tuning ? `tuning ${tab.tuning.join(" ")}` : null,
    tab.capo !== null ? (tab.capo === 0 ? "capo none" : `capo fret ${tab.capo}`) : null,
  ].filter((m): m is string => Boolean(m));

  return (
    <>
      {/* 980px, because that is what a stave measures: two bars of sixteen
          positions at three characters each, plus the string label and the
          border this page draws down the left of it. A narrower reading column
          looked calmer and made every tab scroll sideways, which is not calm. */}
      <main className="mx-auto max-w-[980px] px-[22px] pb-[140px] pt-7">
        <CommandLine>
          open {tab.provider}/{tab.id}
        </CommandLine>

        {/* The song is what this screen is about, so it takes the display step
            and the path above it drops to chrome. */}
        <div className="mt-2 mb-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5 border-term-fg border-b-2 pb-3">
          <h1 className="tt-display font-bold">{tab.title}</h1>
          <span className="text-[15px] text-term-dim">· {tab.artist}</span>
          <span className="flex-1" />
          <span className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5 text-[11px] text-term-faint">
            {metaBits.map((m) => (
              <span key={m} className="flex-none whitespace-nowrap">
                {m}
              </span>
            ))}
          </span>
        </div>

        {tab.license && <div className="mb-[26px] text-[11px] text-term-faint">{tab.license}</div>}

        {parsed.blocks.length > 0 ? (
          <TabRender
            blocks={parsed.blocks}
            column={playing ? column : -1}
            activeRef={activeStaveRef}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-[13px] text-term-dim leading-[1.9]">
            this tab has no content yet.
          </pre>
        )}
      </main>

      <PlaybackBar
        playable={playable}
        playing={playing}
        bpm={bpm}
        column={column}
        parsed={parsed}
        toggle={toggle}
        setBpm={setBpm}
      >
        <span className="flex-1" />
        {editHref && (
          <button type="button" onClick={edit} className="text-term-dim hover:text-term-accent">
            [e] edit
          </button>
        )}
        <button type="button" onClick={back} className="text-term-faint hover:text-term-fg">
          [esc] back
        </button>
      </PlaybackBar>
    </>
  );
}
