"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useThemeCycle } from "@/components/chrome/use-theme-cycle";
import { useTabPlayback } from "@/hooks/use-tab-playback";
import type { Tab } from "@/server/tabs/types";
import { favKey, useSession } from "@/stores/session";
import { anyModalOpen } from "@/stores/ui";
import { CapabilityBadge } from "./capability-badge";
import { TabRender } from "./tab-render";

export function TabView({ tab, backHref }: { tab: Tab; backHref: Route }) {
  const router = useRouter();
  const { cycle } = useThemeCycle();

  const { parsed, playable, playing, bpm, column, toggle, stop, setBpm } = useTabPlayback(
    tab.content,
    tab.tuning,
  );

  const [autoscroll, setAutoscroll] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const activeStaveRef = useRef<HTMLDivElement>(null);

  const favs = useSession((s) => s.favs);
  const toggleFavStore = useSession((s) => s.toggleFav);
  const faved = favs.some((f) => favKey(f) === favKey(tab));
  const toggleFav = () =>
    toggleFavStore({
      provider: tab.provider,
      id: tab.id,
      title: tab.title,
      artist: tab.artist,
      type: tab.type,
      capability: tab.capability,
    });

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

  // space play · f focus · t theme · a autoscroll · s fav · esc back
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
      if (e.key === "s") toggleFav();
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

  const totalBars = Math.max(1, Math.ceil(parsed.totalColumns / 16));
  const currentBar = column < 0 ? 0 : Math.min(totalBars, Math.floor(column / 16) + 1);

  return (
    <>
      <main
        className={`mx-auto px-[22px] pb-[140px] pt-7 ${focusMode ? "max-w-[1100px]" : "max-w-[900px]"}`}
      >
        {!focusMode && (
          <div className="mb-1 text-term-dim">
            <span className="text-term-accent">$</span> open {tab.provider}/{tab.id}
          </div>
        )}

        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5 border-b border-term-fg pb-2.5">
          <h1 className="font-bold text-[19px]">{tab.title}</h1>
          <span className="text-term-dim">· {tab.artist}</span>
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

      <div className="fixed right-0 bottom-0 left-0 z-[6] flex flex-wrap items-center gap-5 border-term-line border-t bg-term-panel px-[22px] py-2.5 text-[12px]">
        {playable ? (
          <>
            <button
              type="button"
              onClick={toggle}
              className="w-[74px] text-left text-term-accent hover:text-term-fg"
            >
              {playing ? "■ stop" : "▶ play"}
            </button>
            <span className="text-term-dim">
              bar {currentBar} / {totalBars}
            </span>
            <span className="flex items-center gap-2 text-term-dim">
              <button type="button" onClick={() => setBpm((b) => b - 4)} className="px-1">
                -
              </button>
              <span className="text-term-fg">{bpm} bpm</span>
              <button type="button" onClick={() => setBpm((b) => b + 4)} className="px-1">
                +
              </button>
            </span>
            <button
              type="button"
              onClick={() => setAutoscroll((v) => !v)}
              className={autoscroll ? "text-term-fg" : "text-term-faint"}
            >
              autoscroll {autoscroll ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => setFocusMode((v) => !v)}
              className={focusMode ? "text-term-fg" : "text-term-faint"}
            >
              focus {focusMode ? "on" : "off"}
            </button>
          </>
        ) : (
          <span className="text-term-faint">no stave to play — text only</span>
        )}
        <button
          type="button"
          onClick={toggleFav}
          className={`whitespace-nowrap hover:text-term-accent ${faved ? "text-term-accent" : "text-term-faint"}`}
        >
          {faved ? "★ favorited [s]" : "☆ favorite [s]"}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={back} className="text-term-faint hover:text-term-fg">
          [esc] back
        </button>
      </div>
    </>
  );
}
