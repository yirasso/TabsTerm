/**
 * A stave as a grid of cells, so it can be edited a position at a time.
 *
 * Editing tablature as text means every keystroke can break the thing that
 * makes tablature readable — the column. Type `12` where a `0` was and every
 * string below it is now off by one, silently, until someone notices the bars
 * no longer line up.
 *
 * Reading the stave into fixed cells and writing it back out removes the
 * failure mode instead of correcting it afterwards: a cell is always
 * `CELL_WIDTH` characters, so a stave that went through here is square by
 * construction and there is nothing left for an align step to fix.
 */

import { CELL_WIDTH } from "./grid";

/** Everything up to and including the label's bar: `e|`, `G#|`. */
const LABEL = /^(\s*[A-Ga-g][#b]?\s*\|)/;

export const EMPTY_CELL = "-".repeat(CELL_WIDTH);
/** Above this is not a guitar neck, it is a typo. */
export const MAX_FRET = 24;

export type StaveGrid = {
  /** One per line, high string first: `e|`, `B|`, … */
  labels: string[];
  /** `cells[line][position]`, each exactly CELL_WIDTH characters. */
  cells: string[][];
  /**
   * Positions a bar line is drawn *before*. A bar closing the stave is recorded
   * at `width`, one past the last cell.
   */
  bars: number[];
};

/**
 * Read raw stave lines into cells.
 *
 * Ragged input is padded rather than rejected — someone typing by hand, or
 * pasting from elsewhere, should get a usable grid instead of an error, and
 * squaring it up is the whole point. Bars are structural: if any line has one
 * at a position, every line gets one, which is what keeps them in a column.
 */
export function readStave(lines: string[]): StaveGrid {
  const labels: string[] = [];
  const perLine: { cells: string[]; bars: number[] }[] = [];

  for (const line of lines) {
    const label = LABEL.exec(line)?.[1] ?? "";
    labels.push(label);

    const body = line.slice(label.length);
    const cells: string[] = [];
    const bars: number[] = [];

    for (let at = 0; at < body.length; ) {
      if (body[at] === "|") {
        bars.push(cells.length);
        at += 1;
        continue;
      }
      cells.push(body.slice(at, at + CELL_WIDTH).padEnd(CELL_WIDTH, "-"));
      at += CELL_WIDTH;
    }

    perLine.push({ cells, bars });
  }

  const width = Math.max(0, ...perLine.map((p) => p.cells.length));
  const bars = [...new Set(perLine.flatMap((p) => p.bars))]
    .filter((b) => b <= width)
    .sort((a, b) => a - b);

  return {
    labels,
    bars,
    cells: perLine.map((p) => [
      ...p.cells,
      ...Array.from({ length: width - p.cells.length }, () => EMPTY_CELL),
    ]),
  };
}

/** Back to raw lines, square by construction. */
export function writeStave(grid: StaveGrid): string[] {
  const bars = new Set(grid.bars);
  const width = grid.cells[0]?.length ?? 0;

  return grid.cells.map((row, line) => {
    let out = grid.labels[line] ?? "";
    for (let at = 0; at < width; at++) {
      if (bars.has(at)) out += "|";
      out += row[at] ?? EMPTY_CELL;
    }
    if (bars.has(width)) out += "|";
    return out;
  });
}

/** How a fret is written in a cell. `null` empties it. */
export function fretText(fret: number | null): string {
  if (fret === null || fret < 0 || fret > MAX_FRET) return EMPTY_CELL;
  return String(fret).padEnd(CELL_WIDTH, "-");
}

/** The fret in a cell, or null when there is no number in it. */
export function cellFret(cell: string | undefined): number | null {
  const digits = /^(\d{1,2})/.exec(cell ?? "")?.[1];
  if (digits === undefined) return null;
  const fret = Number.parseInt(digits, 10);
  return fret > MAX_FRET ? null : fret;
}

/** A copy with one cell replaced. Out-of-range coordinates change nothing. */
export function setCell(grid: StaveGrid, line: number, position: number, text: string): StaveGrid {
  const row = grid.cells[line];
  if (!row || position < 0 || position >= row.length) return grid;

  return {
    ...grid,
    cells: grid.cells.map((r, i) =>
      i === line ? r.map((c, p) => (p === position ? text.padEnd(CELL_WIDTH, "-") : c)) : r,
    ),
  };
}

/**
 * Splice stave lines back into the whole tab.
 *
 * The grid only ever owns its own lines, so labels, prose and other staves
 * around it survive an edit untouched.
 */
export function replaceLines(
  content: string,
  from: number,
  count: number,
  lines: string[],
): string {
  const all = content.split(/\r?\n/);
  all.splice(from, count, ...lines);
  return all.join("\n");
}
