/**
 * Fretted notes back out to ASCII tablature — the inverse of parse-notes.ts,
 * and what turns an analysis into something a person can read and edit.
 */

import { staveLabels } from "./edit";
import type { FrettedNote } from "./fretting";
import { CELL_WIDTH } from "./grid";

const COLUMNS_PER_BAR = 16;
const BARS_PER_LINE = 2;

export type AsciiOptions = {
  tuning: string[];
  /** Columns per second — the time-to-space conversion. */
  columnsPerSecond?: number;
};

/**
 * Lay notes onto a grid. Time becomes column, string becomes line, and the
 * result is padded so every line of a stave is the same length — the invariant
 * the reader and the player both depend on.
 */
export function notesToAscii(notes: FrettedNote[], options: AsciiOptions): string {
  const { tuning, columnsPerSecond = 8 } = options;
  const labels = staveLabels(tuning, tuning.length);
  if (notes.length === 0) return "";

  const start = notes[0]?.time ?? 0;
  const placed = notes.map((n) => ({
    ...n,
    column: Math.round((n.time - start) * columnsPerSecond),
  }));

  const lastColumn = Math.max(...placed.map((n) => n.column));
  const totalBars = Math.max(1, Math.ceil((lastColumn + 2) / COLUMNS_PER_BAR));

  const staves: string[] = [];

  for (let bar = 0; bar < totalBars; bar += BARS_PER_LINE) {
    const from = bar * COLUMNS_PER_BAR;
    const to = Math.min(totalBars, bar + BARS_PER_LINE) * COLUMNS_PER_BAR;

    const lines = labels.map((label, string) => {
      // Fixed-width cells: `0-`, `12` and `--` all measure the same, so a wide
      // fret can never steal the position after it or break the column.
      const cells: string[] = Array.from({ length: to - from }, () => "-".repeat(CELL_WIDTH));

      for (const note of placed) {
        if (note.string !== string) continue;
        const at = note.column - from;
        if (at < 0 || at >= cells.length) continue;
        cells[at] = String(note.fret).padEnd(CELL_WIDTH, "-");
      }

      // Rebuild with bar lines every COLUMNS_PER_BAR positions.
      let line = `${label}|`;
      cells.forEach((cell, i) => {
        line += cell;
        if ((from + i + 1) % COLUMNS_PER_BAR === 0) line += "|";
      });
      return line;
    });

    staves.push(lines.join("\n"));
  }

  return staves.join("\n\n");
}
