"use client";

import { useEffect } from "react";
import { useUi } from "@/stores/ui";

const MAN_PAGE = `NAME
  tabsterm — guitar tablature behind a text prompt

DESCRIPTION
  Every tab site buried the tab under ads, autoplay video and
  a wall of lyrics. TabsTerm is the opposite: one prompt, one
  query, the tab. Type a song, pick a version, play. Slash
  commands for everything else, favorites with [s], no login
  required to read anything.

BADGES
  Every result says up front what it gives you.

  audio   playable — a digital guitar plays it back and a
          cursor walks the tab in time
  text    readable, but with no stave we can turn into notes

  Everything here is hosted by us. Nothing is scraped from
  another site, so nothing sends you somewhere else to read.`;

export function AboutModal() {
  const closeAbout = useUi((s) => s.closeAbout);

  // Capture phase so screen-level Escape handlers never see this event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeAbout();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closeAbout]);

  return (
    <div className="fixed inset-0 z-[24] flex items-start justify-center pt-[14vh]">
      <button
        type="button"
        aria-label="close"
        onClick={closeAbout}
        className="tt-overlay absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="man tabsterm"
        className="tt-modal relative w-[min(560px,92vw)]"
      >
        <div className="flex items-baseline gap-2.5 border-b border-term-line px-3.5 py-[11px]">
          <span className="text-term-accent">$</span>
          <span className="whitespace-nowrap text-[12px] text-term-dim">man tabsterm</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={closeAbout}
            className="whitespace-nowrap text-[11px] text-term-faint"
          >
            esc
          </button>
        </div>
        <div className="px-3.5 pb-3.5 pt-4">
          <pre className="mb-4 whitespace-pre-wrap text-[12.5px] leading-[1.85] text-term-dim">
            {MAN_PAGE}
          </pre>
          <div className="mb-[18px] border-l-2 border-term-accent pl-3.5">
            <div className="text-[14px] leading-[1.6]">
              “Without music, life would be a mistake.”
            </div>
            <div className="mt-1.5 text-[11px] text-term-faint">
              — Friedrich Nietzsche, Twilight of the Idols (1889)
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="https://github.com/yirasso"
              target="_blank"
              rel="noreferrer noopener"
              className="whitespace-nowrap border border-term-line px-3 py-2 text-[12px] text-term-fg hover:border-term-accent hover:text-term-accent"
            >
              made by yirasso · github ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
