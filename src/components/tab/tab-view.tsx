"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useThemeCycle } from "@/components/chrome/use-theme-cycle";
import type { Tab } from "@/server/tabs/types";
import { favKey, useSession } from "@/stores/session";
import { anyModalOpen } from "@/stores/ui";
import { parseSections } from "./parse-sections";

export function TabView({ tab, backHref }: { tab: Tab; backHref: Route }) {
  const router = useRouter();
  const { cycle } = useThemeCycle();

  const sections = parseSections(tab.content);
  const playable = sections.length > 0;

  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [bpm, setBpm] = useState(96);
  const [autoscroll, setAutoscroll] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      rating: tab.rating,
    });

  const back = () => router.push(backHref);

  // The design's playback loop: one tick per section, 4 beats per tick.
  useEffect(() => {
    if (!playing || !playable) return;
    const ms = (60000 / bpm) * 4;
    const timer = setInterval(() => {
      setBeat((b) => {
        const next = b + 1;
        if (next >= sections.length) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, ms);
    return () => clearInterval(timer);
  }, [playing, bpm, playable, sections.length]);

  useEffect(() => {
    if (!playing || !autoscroll) return;
    const el = scrollRef.current?.children[beat] as HTMLElement | undefined;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [beat, playing, autoscroll]);

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
          setPlaying((p) => !p);
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
    tab.type,
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
          <div className="mb-1 text-term-dim">
            <span className="text-term-accent">$</span> open {tab.provider}/{tab.id}
          </div>
        )}

        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5 border-b border-term-fg pb-2.5">
          <h1 className="text-[19px] font-bold">{tab.title}</h1>
          <span className="text-term-dim">· {tab.artist}</span>
          <span className="flex-1" />
          <span className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[11px] text-term-faint">
            {metaBits.map((m) => (
              <span key={m} className="flex-none whitespace-nowrap">
                {m}
              </span>
            ))}
          </span>
        </div>

        {!focusMode && (
          <div className="mb-[26px] text-[11px] text-term-faint">
            source: {tab.provider}
            {tab.sourceUrl && (
              <>
                {" · "}
                <a href={tab.sourceUrl} target="_blank" rel="noreferrer noopener">
                  view on source ↗
                </a>
              </>
            )}
          </div>
        )}

        {playable ? (
          <div ref={scrollRef} className="flex flex-col gap-[34px]">
            {sections.map((sec, i) => {
              const active = playing && i === beat;
              return (
                <div
                  // Sections are parsed from static content and never reorder;
                  // label + first body line is stable and unique enough.
                  key={`${sec.label}:${sec.body.slice(0, 24)}`}
                  className="border-l-2 pl-4"
                  style={{
                    borderColor: active ? "var(--tt-accent)" : "var(--tt-line)",
                    opacity: playing && !active ? 0.42 : 1,
                  }}
                >
                  <div className="mb-1.5 flex items-baseline gap-2.5">
                    <span
                      className={`flex-none whitespace-nowrap text-[11px] uppercase tracking-[0.14em] ${active ? "text-term-accent" : "text-term-dim"}`}
                    >
                      {sec.label}
                    </span>
                  </div>
                  <pre className="tab-content text-[13px] leading-[1.8] tracking-[0.02em]">
                    {sec.body}
                  </pre>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <pre className="whitespace-pre-wrap text-[13px] leading-[1.9] text-term-dim">
              {`this tab is hosted by ${tab.provider} — the transcription lives on their site.`}
            </pre>
            {tab.sourceUrl && (
              <a
                href={tab.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-[22px] inline-block border border-term-line px-3 py-[7px] text-[12px] hover:border-term-accent"
              >
                open on {tab.provider} ↗
              </a>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-[6] flex flex-wrap items-center gap-5 border-t border-term-line bg-term-panel px-[22px] py-2.5 text-[12px]">
        {playable && (
          <>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="w-[74px] text-left text-term-accent hover:text-term-fg"
            >
              {playing ? "■ stop" : "▶ play"}
            </button>
            <span className="text-term-dim">
              bar {beat * 4 + 1} / {sections.length * 4}
            </span>
            <span className="flex items-center gap-2 text-term-dim">
              <button
                type="button"
                onClick={() => setBpm((b) => Math.max(40, b - 4))}
                className="px-1"
              >
                -
              </button>
              <span className="text-term-fg">{bpm} bpm</span>
              <button
                type="button"
                onClick={() => setBpm((b) => Math.min(220, b + 4))}
                className="px-1"
              >
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
