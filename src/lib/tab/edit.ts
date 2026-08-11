/**
 * The chores that make hand-writing ASCII tablature bearable: producing blank
 * staves, and keeping every line of a stave the same length so the grid stays
 * square. Pure functions, so the editor stays a thin shell over them.
 */

import { CELL_WIDTH } from "./grid";

/** String labels, high string first, matching how tab lines are stacked. */
const GUITAR_LABELS = ["e", "B", "G", "D", "A", "E"];
const BASS_LABELS = ["G", "D", "A", "E"];

const STAVE_LINE = /^\s*[A-Ga-g][#b]?\s*\|/;

/** Labels for a declared tuning, or the standard ones when it does not fit. */
export function staveLabels(tuning: string[] | null, strings = 6): string[] {
  const fallback = strings === 4 ? BASS_LABELS : GUITAR_LABELS;
  if (!tuning || tuning.length !== strings) return fallback;

  // Tunings read low string first; stave lines run high string first. Lowercase
  // the top string, which is the convention that makes a stave scannable.
  const highFirst = [...tuning].reverse();
  return highFirst.map((note, i) => (i === 0 ? note.toLowerCase() : note.toUpperCase()));
}

/** Positions per bar — kept in step with the generator's grid. */
const POSITIONS_PER_BAR = 8;

/** An empty stave, ready to be filled in, already on the two-character grid. */
export function blankStave(tuning: string[] | null = null, strings = 6, bars = 2): string {
  const labels = staveLabels(tuning, strings);
  const width = Math.max(1, bars);
  const bar = "-".repeat(POSITIONS_PER_BAR * CELL_WIDTH);
  return labels.map((label) => `${label}|${`${bar}|`.repeat(width)}`).join("\n");
}

export type TabIssue = { line: number; message: string };

/**
 * Problems worth telling the writer about, as line numbers they can jump to.
 * Deliberately not a linter: it flags what breaks the fixed-width grid, and
 * stays quiet about style.
 */
export function validateTab(content: string): TabIssue[] {
  const lines = content.split(/\r?\n/);
  const issues: TabIssue[] = [];

  let start = -1;

  const check = (from: number, to: number) => {
    const run = lines.slice(from, to);
    if (run.length < 4) {
      issues.push({
        line: from + 1,
        message: `stave has ${run.length} strings — needs at least 4`,
      });
      return;
    }
    const widths = new Set(run.map((l) => l.length));
    if (widths.size > 1) {
      issues.push({
        line: from + 1,
        message: `stave lines are ${[...widths].sort((a, b) => a - b).join("/")} characters — align them`,
      });
    }
  };

  lines.forEach((line, i) => {
    if (STAVE_LINE.test(line)) {
      if (start === -1) start = i;
      return;
    }
    if (start !== -1) check(start, i);
    start = -1;
  });
  if (start !== -1) check(start, lines.length);

  return issues;
}

/**
 * Insert text at a cursor position, returning the new value and caret.
 *
 * The insert always lands on its own lines so a stave never fuses with prose,
 * and always ends on a fresh one so the caret is ready for whatever comes next.
 */
export function insertAt(value: string, at: number, text: string) {
  const before = value.slice(0, at);
  const after = value.slice(at);
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const trail = after.startsWith("\n") ? "" : "\n";
  const insert = `${lead}${text}${trail}`;
  return { value: before + insert + after, caret: at + insert.length };
}
