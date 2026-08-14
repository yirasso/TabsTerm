"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CommandLine } from "@/components/chrome/command-line";
import { useThemeCycle } from "@/components/chrome/use-theme-cycle";
import { useTabPlayback } from "@/hooks/use-tab-playback";
import type { Tab } from "@/lib/tabs/contract";
import { anyModalOpen } from "@/stores/ui";
import { CapabilityBadge } from "./capability-badge";
import { PlaybackBar } from "./playback-bar";
import { TabRender } from "./tab-render";

export function TabView({ tab, backHref }: { tab: Tab; backHref: Route }) {
  const router = useRouter();
  const { cycle } = useThemeCycle();

  const { parsed, playable, playing, bpm, column, toggle, stop, setBpm } = useTabPlayback(
    tab.content,
    tab.tuning,
    tab.capo ?? 0,
  );

  const [autoscroll, setAutoscroll] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const activeStaveRef = useRef<HTMLDivElement>(null);

  const back = () => {
    stop();
    router.push(backHref);
  };

  // Follow the cursor by scrolling to whichever stave holds it.
  useEffect(() => {
    if (!playing || !autoscroll) return;
    const el = activeStaveRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [playing, autoscroll]);

  // space play · f focus · t theme · a autoscroll · esc back
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
      if (e.key === "f") setFocusMode((v) => !v);
      if (e.key === "t") cycle();
      if (e.key === "a") setAutoscroll((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const metaBits = [
    tab.tuning ? `tuning ${tab.tuning.join(" ")}` : null,
    tab.capo !== null ? (tab.capo === 0 ? "capo none" : `capo fret ${tab.capo}`) : null,
    tab.difficulty,
    tab.provider,
  ].filter((m): m is string => Boolean(m));

  return (
    <>
      <main
        className={`mx-auto px-[22px] pb-[140px] pt-7 ${focusMode ? "max-w-[1100px]" : "max-w-[900px]"}`}
      >
        {!focusMode && (
          <CommandLine>
            open {tab.provider}/{tab.id}
          </CommandLine>
        )}

        {/* The song is what this screen is about, so it takes the display step
            and the path above it drops to chrome. */}
        <div className="mt-2 mb-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5 border-term-fg border-b-2 pb-3">
          <h1 className="tt-display font-bold">{tab.title}</h1>
          <span className="text-[15px] text-term-dim">· {tab.artist}</span>
          <span className="flex-1" />
          <span className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5 text-[11px] text-term-faint">
            <CapabilityBadge capability={tab.capability} detailed />
            {metaBits.map((m) => (
              <span key={m} className="flex-none whitespace-nowrap">
                {m}
              </span>
            ))}
          </span>
        </div>

        {!focusMode && (
          <div className="mb-[26px] text-[11px] text-term-faint">
            {tab.attributionName ? `transcribed by ${tab.attributionName} · ` : ""}
            source: {tab.provider}
            {tab.license ? ` · ${tab.license}` : ""}
          </div>
        )}

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
        totalColumns={parsed.totalColumns}
        toggle={toggle}
        setBpm={setBpm}
        autoscroll={{ on: autoscroll, toggle: () => setAutoscroll((v) => !v) }}
        focus={{ on: focusMode, toggle: () => setFocusMode((v) => !v) }}
      >
        <span className="flex-1" />
        <button type="button" onClick={back} className="text-term-faint hover:text-term-fg">
          [esc] back
        </button>
      </PlaybackBar>
    </>
  );
}
