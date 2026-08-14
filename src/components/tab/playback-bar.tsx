"use client";

import type { ReactNode } from "react";
import { CELL_WIDTH, COLUMNS_PER_BAR } from "@/lib/tab/grid";

/**
 * Characters in a bar. `COLUMNS_PER_BAR` counts notation positions and the
 * player counts characters, so the two only agree once multiplied — dividing a
 * character column by a position count made the counter claim three bars for a
 * two-bar stave.
 */
const CHARS_PER_BAR = COLUMNS_PER_BAR * CELL_WIDTH;

/** A control that is only shown when the screen has something to do with it. */
type Toggle = { on: boolean; toggle: () => void };

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
  totalColumns,
  toggle,
  setBpm,
  focus,
  children,
}: {
  playable: boolean;
  playing: boolean;
  bpm: number;
  column: number;
  totalColumns: number;
  toggle: () => void;
  setBpm: (next: (prev: number) => number) => void;
  focus?: Toggle;
  children?: ReactNode;
}) {
  const totalBars = Math.max(1, Math.ceil(totalColumns / CHARS_PER_BAR));
  const currentBar = column < 0 ? 0 : Math.min(totalBars, Math.floor(column / CHARS_PER_BAR) + 1);

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
            bar <span className="text-term-fg">{currentBar}</span> / {totalBars}
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
          {focus && (
            <button
              type="button"
              onClick={focus.toggle}
              className={focus.on ? "text-term-fg" : "text-term-faint"}
            >
              focus {focus.on ? "on" : "off"}
            </button>
          )}
        </>
      ) : (
        <span className="text-term-faint">no stave to play — text only</span>
      )}
      {children}
    </div>
  );
}
