/**
 * The house grid: every notation position is exactly two characters wide.
 *
 * ASCII tablature written one character per position has a flaw that shows up
 * the moment anyone plays above the ninth fret — `12` needs two characters and
 * `0` needs one, so a two-digit fret either pushes everything after it out of
 * line or, worse, silently swallows the next time position. Either way the
 * columns stop meaning the same thing on every string.
 *
 * Two characters per position fixes both: `0-`, `7-`, `12` all measure the
 * same, so a reader can count positions down a column and the parser's
 * character-column-as-time assumption stays true.
 */

export const CELL_WIDTH = 2;

const STAVE_LINE = /^\s*[A-Ga-g][#b]?\s*\|/;
/** Everything up to and including the label's bar. */
const LABEL = /^(\s*[A-Ga-g][#b]?\s*\|)/;

type Token =
  | { kind: "bar" }
  | { kind: "empty" }
  /** A fret number, or a technique marker like `h`, `p`, `/` or `x`. */
  | { kind: "mark"; text: string };

/**
 * Read one line into tokens by character column, and report which columns are
 * only there to hold the second digit of a fret.
 */
function readLine(body: string) {
  const tokens = new Map<number, Token>();
  const continuations = new Set<number>();

  for (let col = 0; col < body.length; col++) {
    const char = body[col];
    if (char === undefined) continue;

    if (char === "|") {
      tokens.set(col, { kind: "bar" });
      continue;
    }
    if (char === "-") {
      tokens.set(col, { kind: "empty" });
      continue;
    }
    if (char >= "0" && char <= "9") {
      const next = body[col + 1];
      const twoDigit = next !== undefined && next >= "0" && next <= "9";
      tokens.set(col, { kind: "mark", text: twoDigit ? char + next : char });
      if (twoDigit) {
        continuations.add(col + 1);
        col++;
      }
      continue;
    }
    tokens.set(col, { kind: "mark", text: char });
  }

  return { tokens, continuations };
}

/**
 * Is this stave already on the grid? Without this the function is not
 * idempotent: a normalised `0-` reads back as a fret plus an empty position and
 * gets expanded again, doubling the stave every time it runs.
 *
 * The test is that, ignoring bars, every line is an even number of characters
 * and every mark begins on an even one. A one-character stave that happens to
 * satisfy both is left alone, which is harmless — it was already square.
 */
function alreadyOnGrid(parts: { tokens: Map<number, Token> }[]): boolean {
  for (const part of parts) {
    // Measured per bar-delimited segment, since a bar is one character wide and
    // would otherwise flip the parity of everything after it.
    let sinceBar = 0;

    for (const col of [...part.tokens.keys()].sort((a, b) => a - b)) {
      const token = part.tokens.get(col);
      if (!token) continue;

      if (token.kind === "bar") {
        if (sinceBar % CELL_WIDTH !== 0) return false;
        sinceBar = 0;
        continue;
      }
      if (token.kind === "mark" && sinceBar % CELL_WIDTH !== 0) return false;
      sinceBar += token.kind === "mark" ? token.text.length : 1;
    }

    if (sinceBar % CELL_WIDTH !== 0) return false;
  }
  return true;
}

/**
 * Re-lay every stave onto the two-character grid.
 *
 * Columns that exist only to carry a fret's second digit are dropped, because
 * they were never a time position — that is precisely the slot a wide fret used
 * to steal.
 */
export function normaliseGrid(content: string): string {
  const lines = content.split(/\r?\n/);
  const out = [...lines];

  const relay = (from: number, to: number) => {
    const run = lines.slice(from, to);
    if (run.length < 4) return;

    const parts = run.map((line) => {
      const label = LABEL.exec(line)?.[1] ?? "";
      return { label, ...readLine(line.slice(label.length)) };
    });

    if (alreadyOnGrid(parts)) return;

    const width = Math.max(...parts.map((p) => Math.max(...p.tokens.keys(), -1) + 1));

    // A column is a real time position unless some line is using it for the
    // back half of a two-digit fret.
    const skipped = new Set<number>();
    for (const part of parts) for (const col of part.continuations) skipped.add(col);

    for (const [i, part] of parts.entries()) {
      let rebuilt = "";

      for (let col = 0; col < width; col++) {
        if (skipped.has(col)) continue;

        // Bars are structural: if one string has one here, they all do.
        const isBar = parts.some((p) => p.tokens.get(col)?.kind === "bar");
        if (isBar) {
          rebuilt += "|";
          continue;
        }

        const token = part.tokens.get(col);
        rebuilt +=
          token?.kind === "mark" ? token.text.padEnd(CELL_WIDTH, "-") : "-".repeat(CELL_WIDTH);
      }

      out[from + i] = part.label + rebuilt;
    }
  };

  let start = -1;
  lines.forEach((line, i) => {
    if (STAVE_LINE.test(line)) {
      if (start === -1) start = i;
      return;
    }
    if (start !== -1) relay(start, i);
    start = -1;
  });
  if (start !== -1) relay(start, lines.length);

  return out.join("\n");
}
