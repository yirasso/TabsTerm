"use client";

import type { ReactNode } from "react";
import { barAtColumn, type ParsedTab } from "@/lib/tab/parse-notes";

/**
 * The bar along the bottom that drives playback.
 *
 * It belongs to the tablature rather than to the reading screen, so writing a
 * tab and reading one get the same controls: someone typing a stave needs to
 * hear it more than someone who came to read it. What differs between the two
 * screens is what sits at the end of the bar, which is why that is a slot.
 */
export function PlaybackBar({
  playable,
  playing,
  bpm,
  column,
  parsed,
  toggle,
  setBpm,
  children,
}: {
  playable: boolean;
  playing: boolean;
  bpm: number;
  column: number;
  /**
   * The parse, not a column total: only it knows where the bars are. A bar is
   * `COLUMNS_PER_BAR` notation positions, and a stave line holds characters
   * that are not positions — the string label and the bar lines — so no
   * division of a character count can land on a bar boundary.
   */
  parsed: ParsedTab;
  toggle: () => void;
  setBpm: (next: (prev: number) => number) => void;
  children?: ReactNode;
}) {
  const currentBar = barAtColumn(parsed, column);

  return (
    <div className="fixed right-0 bottom-0 left-0 z-[6] flex flex-wrap items-center gap-5 border-term-line border-t bg-term-panel px-[22px] py-2.5 text-[12px]">
      {playable ? (
        <>
          {/* The one action on this bar. It was a word among nine other words;
              a bordered accent block is the system's own button idiom, spent on
              the control that matters most here. */}
          <button
            type="button"
            onClick={toggle}
            className="w-[86px] border border-term-accent px-2.5 py-[5px] text-center text-[13px] text-term-accent hover:bg-term-accent hover:text-term-bg"
          >
            {playing ? "■ stop" : "▶ play"}
          </button>
          <span className="text-term-dim">
            bar <span className="text-term-fg">{currentBar}</span> / {parsed.totalBars}
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
        </>
      ) : (
        <span className="text-term-faint">no stave to play — text only</span>
      )}
      {children}
    </div>
  );
}
