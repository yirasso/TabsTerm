"use client";

import { useEffect, useRef, useState } from "react";
import {
  cellFret,
  fretText,
  MAX_FRET,
  readStave,
  replaceLines,
  setCell,
  writeStave,
} from "@/lib/tab/cells";
import { CELL_WIDTH } from "@/lib/tab/grid";
import type { TabBlock } from "@/lib/tab/parse-notes";

/**
 * Where a cell starts in its raw line.
 *
 * Playback counts in characters, because that is what the parser reads a tab
 * as; the grid counts in cells. They are not the same number — cells are
 * CELL_WIDTH wide and a bar line is one character — so the cursor has to be
 * translated or it drifts a little further right with every bar.
 */
function charOffset(labelWidth: number, bars: Set<number>, position: number): number {
  let at = labelWidth;
  for (let p = 0; p <= position; p++) {
    if (bars.has(p)) at += 1;
    if (p < position) at += CELL_WIDTH;
  }
  return at;
}

/** Where the caret is: which stave, which string, which position. */
type Spot = { block: string; line: number; position: number };

const same = (a: Spot | null, b: Spot) =>
  a !== null && a.block === b.block && a.line === b.line && a.position === b.position;

/**
 * The tab as something you click, rather than something you type.
 *
 * Every position is a cell you can select and put a fret in. That is worth more
 * than the keystrokes it saves: editing through cells means a fret can never
 * push the rest of the line sideways, so the columns stay in a column and the
 * alignment problem stops existing instead of being cleaned up afterwards.
 *
 * The text area is still there for pasting and for bulk edits. Both write the
 * same string, so neither is the real one.
 */
export function TabGrid({
  content,
  blocks,
  column,
  activeRef,
  onChange,
}: {
  content: string;
  blocks: TabBlock[];
  /** Playback position, in global columns. -1 when stopped. */
  column: number;
  /** Set on whichever stave holds the playback cursor, for autoscroll. */
  activeRef?: React.RefObject<HTMLDivElement | null>;
  onChange: (next: string) => void;
}) {
  const [spot, setSpot] = useState<Spot | null>(null);
  // Digits typed since the caret last moved, so `1` then `2` means fret 12
  // rather than fret 2 — the same way a tab is read aloud.
  const [typed, setTyped] = useState("");
  const caretRef = useRef<HTMLButtonElement>(null);

  // Keys are delivered to whatever the browser has focused, so a selection the
  // focus did not follow would send the next digit to the cell just left.
  useEffect(() => {
    if (spot) caretRef.current?.focus();
  }, [spot]);

  const move = (next: Spot) => {
    setSpot(next);
    setTyped("");
  };

  const write = (block: Extract<TabBlock, { kind: "stave" }>, at: Spot, text: string) => {
    const grid = setCell(readStave(block.lines), at.line, at.position, text);
    onChange(replaceLines(content, block.firstLine, block.lines.length, writeStave(grid)));
  };

  const onKey = (
    event: React.KeyboardEvent,
    block: Extract<TabBlock, { kind: "stave" }>,
    at: Spot,
    width: number,
  ) => {
    const { key } = event;

    if (key >= "0" && key <= "9") {
      event.preventDefault();
      // A second digit only counts if the two together are still a fret; `1`
      // then `9` is 19, but `2` then `9` is a new 9, not a 29th fret.
      const combined = Number.parseInt(typed + key, 10);
      const fret = typed && combined <= MAX_FRET ? combined : Number.parseInt(key, 10);
      setTyped(typed && combined <= MAX_FRET ? "" : key);
      write(block, at, fretText(fret));
      return;
    }

    if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      setTyped("");
      write(block, at, fretText(null));
      return;
    }

    const step: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      " ": [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const delta = step[key];
    if (!delta) return;

    event.preventDefault();
    const [dLine, dPosition] = delta;
    const line = Math.min(block.lines.length - 1, Math.max(0, at.line + dLine));
    const position = Math.min(width - 1, Math.max(0, at.position + dPosition));
    move({ ...at, line, position });
  };

  return (
    <div className="tab-content text-[15px] leading-[1.85]">
      {blocks.map((block) => {
        if (block.kind === "label") {
          return (
            <div key={block.id} className="mt-4 mb-1 text-term-accent first:mt-0">
              [{block.text}]
            </div>
          );
        }
        if (block.kind === "text") {
          return (
            <div key={block.id} className="mb-1 whitespace-pre-wrap text-term-dim">
              {block.text}
            </div>
          );
        }

        const grid = readStave(block.lines);
        const width = grid.cells[0]?.length ?? 0;
        const bars = new Set(grid.bars);
        const local = column - block.columnOffset;
        const holdsCursor = local >= 0 && local < block.width;

        return (
          <div
            key={block.id}
            ref={holdsCursor ? activeRef : undefined}
            className="mb-4 overflow-x-auto"
          >
            {grid.cells.map((row, line) => (
              // Stave lines have no identity beyond their order in the stave,
              // and that order is fixed.
              // biome-ignore lint/suspicious/noArrayIndexKey: the string number is the identity
              <div key={line} className="flex whitespace-pre">
                <span className="text-term-faint">{grid.labels[line]}</span>
                {row.map((cell, position) => {
                  const at: Spot = { block: block.id, line, position };
                  const starts = charOffset((grid.labels[line] ?? "").length, bars, position);
                  const active = holdsCursor && local >= starts && local < starts + CELL_WIDTH;

                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity
                    <span key={position} className="flex">
                      {bars.has(position) && <span className="text-term-faint">|</span>}
                      <button
                        type="button"
                        ref={same(spot, at) ? caretRef : undefined}
                        // One entry point per stave until something is selected,
                        // so Tab does not walk through every position on the way
                        // past.
                        tabIndex={
                          spot ? (same(spot, at) ? 0 : -1) : line === 0 && position === 0 ? 0 : -1
                        }
                        data-testid={active ? "tab-cursor" : undefined}
                        aria-label={`string ${line + 1}, position ${position + 1}${
                          cellFret(cell) === null ? "" : `, fret ${cellFret(cell)}`
                        }`}
                        onClick={() => move(at)}
                        onKeyDown={(e) => onKey(e, block, at, width)}
                        className={`whitespace-pre border-0 bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] outline-none ${
                          same(spot, at)
                            ? "tt-caret"
                            : active
                              ? "text-term-accent"
                              : cellFret(cell) === null
                                ? "text-term-faint hover:text-term-accent"
                                : "text-term-fg hover:text-term-accent"
                        }`}
                      >
                        {cell}
                      </button>
                    </span>
                  );
                })}
                {bars.has(width) && <span className="text-term-faint">|</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
