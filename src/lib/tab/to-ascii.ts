/**
 * Fretted notes back out to ASCII tablature — the inverse of parse-notes.ts,
 * and what turns an analysis into something a person can read and edit.
 */

import { staveLabels } from "./edit";
import type { FrettedNote } from "./fretting";

export type ChordEvent = { name: string; time: number };

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
      // One cell per column, so a two-digit fret can claim the next cell.
      const cells: string[] = Array.from({ length: to - from }, () => "-");

      for (const note of placed) {
        if (note.string !== string) continue;
        const at = note.column - from;
        if (at < 0 || at >= cells.length) continue;
        const text = String(note.fret);
        cells[at] = text;
        // A two-character fret eats the following cell, or the grid shifts.
        if (text.length === 2 && at + 1 < cells.length) cells[at + 1] = "";
      }

      // Rebuild with bar lines every COLUMNS_PER_BAR columns.
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

/**
 * A chord sheet. Chord recognition gives names and times, not notes, so this is
 * a different artefact from tablature and the wording says so.
 */
export function chordsToAscii(chords: ChordEvent[], perLine = 4): string {
  if (chords.length === 0) return "";

  // Collapse repeats: a chord held for eight beats is one chord, not eight.
  const collapsed: ChordEvent[] = [];
  for (const chord of chords) {
    if (collapsed.at(-1)?.name !== chord.name) collapsed.push(chord);
  }

  const lines: string[] = [];
  for (let i = 0; i < collapsed.length; i += perLine) {
    lines.push(
      collapsed
        .slice(i, i + perLine)
        .map((c) => c.name.padEnd(8))
        .join("")
        .trimEnd(),
    );
  }

  return lines.join("\n");
}
