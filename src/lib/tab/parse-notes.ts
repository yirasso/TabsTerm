/**
 * Turns ASCII tablature into ordered blocks and timed notes.
 *
 * A stave is a run of consecutive lines that each start with a string label and
 * a bar, like `e|--0--2--|`. The label gives the string, the digits give the
 * fret, and the COLUMN gives the time — which is the one real approximation
 * here. ASCII tab carries no durations, so each character column becomes a time
 * step. Most tab is written roughly proportionally, so this lands close enough
 * to be useful, and the UI says it is approximate.
 *
 * One parse serves both playback and rendering, so a cursor can never drift
 * from the notes it is supposed to be sitting on.
 */

/** MIDI note numbers, high string first, matching how tab lines are stacked. */
export const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];
export const BASS_TUNING = [43, 38, 33, 28];

export type TabNote = {
  /** Column across the whole tab, with staves laid end to end. */
  column: number;
  /** 0 = top line of its stave. */
  line: number;
  fret: number;
  midi: number;
};

/**
 * Blocks carry their own `id` because identity belongs to the parse, not to the
 * renderer: the order is fixed by immutable content, and two blocks can hold
 * identical text.
 */
export type TabBlock = {
  id: string;
  /**
   * Where this block sits in the source text. An editor rewrites or removes a
   * block by splicing these lines, so it never has to search the content for
   * something it is already looking at — and two identical sections stay
   * distinguishable.
   */
  firstLine: number;
  lineCount: number;
} & (
  | { kind: "label"; text: string }
  | { kind: "text"; text: string }
  | {
      kind: "stave";
      lines: string[];
      /** Columns are local to this stave. */
      notes: TabNote[];
      width: number;
      /** Add this to a local column to get a global one. */
      columnOffset: number;
    }
);

export type ParsedTab = {
  blocks: TabBlock[];
  /** Every note, in global column order. */
  notes: TabNote[];
  totalColumns: number;
};

/** `e|`, `B|`, `G#|`, `D |` — a string label followed by a bar. */
const STAVE_LINE = /^\s*([A-Ga-g][#b]?)\s*\|/;
/** A line that is only `[Something]`. */
const LABEL_LINE = /^\s*\[(.+)\]\s*$/;

const PITCH_CLASS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/**
 * Note names to open-string pitches, high string first — what the analysis needs
 * to know before it can decide where a pitch is played.
 *
 * Names carry no octave, so each one is anchored to the register standard tuning
 * puts that string in. Otherwise drop-D reads as a D an octave off and every
 * fret on the bottom string comes out twelve too high.
 */
export function tuningToMidi(declared: string[] | null, strings = 6): number[] {
  const fallback = strings === 4 ? BASS_TUNING : STANDARD_TUNING;
  if (!declared || declared.length !== fallback.length) return fallback;

  // Tunings are written low string first; stave lines run high string first.
  return [...declared].reverse().map((note, i) => {
    const base = fallback[i] ?? 40;
    const wanted = PITCH_CLASS[note.slice(0, 1).toLowerCase()];
    if (wanted === undefined) return base;
    const accidental = note.includes("#") ? 1 : note.includes("b") ? -1 : 0;
    const target = wanted + accidental;
    return target + Math.round((base - target) / 12) * 12;
  });
}

/**
 * Pick the MIDI base for each line. When the stave's labels match the declared
 * tuning's note names we trust the tuning; otherwise fall back to standard,
 * which is what the overwhelming majority of tab uses.
 */
function tuningFor(lines: string[], declared: string[] | null): number[] {
  const fallback = lines.length === 4 ? BASS_TUNING : STANDARD_TUNING;
  if (!declared || declared.length !== lines.length) return fallback;

  const highFirst = [...declared].reverse();
  const labels = lines.map((l) => STAVE_LINE.exec(l)?.[1]?.toLowerCase() ?? "");
  const matches = highFirst.every((note, i) => note.slice(0, 1).toLowerCase() === labels[i]);
  if (!matches) return fallback;

  return tuningToMidi(declared, lines.length);
}

function readNotes(lines: string[], tuning: number[]): TabNote[] {
  const notes: TabNote[] = [];

  lines.forEach((line, lineIndex) => {
    const base = tuning[lineIndex];
    if (base === undefined) return;

    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (char === undefined || char < "0" || char > "9") continue;
      // A digit right after another digit is the second half of a fret number.
      const prev = line[col - 1];
      if (prev !== undefined && prev >= "0" && prev <= "9") continue;

      const next = line[col + 1];
      const digits = next !== undefined && next >= "0" && next <= "9" ? char + next : char;
      const fret = Number.parseInt(digits, 10);
      if (fret > 24) continue;

      notes.push({ column: col, line: lineIndex, fret, midi: base + fret });
    }
  });

  return notes;
}

/**
 * `capo` shifts every note up by that many frets. Tablature is written relative
 * to the capo — that is the whole point of one, the shapes stay in first
 * position — so the numbers on the page are not the pitches that sound, and
 * playing them back untransposed puts the whole piece in the wrong key.
 */
export function parseTabNotes(
  content: string | null,
  tuning: string[] | null = null,
  capo = 0,
): ParsedTab {
  const empty: ParsedTab = { blocks: [], notes: [], totalColumns: 0 };
  if (!content) return empty;

  const blocks: TabBlock[] = [];
  const notes: TabNote[] = [];
  let offset = 0;

  let staveRun: string[] = [];
  let staveStart = 0;
  let textRun: string[] = [];
  let textStart = 0;

  const nextId = (kind: string) => `${kind}-${blocks.length}`;

  const flushText = () => {
    const text = textRun.join("\n").replace(/^\n+/, "").trimEnd();
    // The block's text is trimmed but its line range is not: removing it has to
    // take the blank lines with it, or deleting prose leaves the gap behind.
    if (text) {
      blocks.push({
        id: nextId("text"),
        kind: "text",
        text,
        firstLine: textStart,
        lineCount: textRun.length,
      });
    }
    textRun = [];
  };

  const flushStave = () => {
    // Four lines is the smallest real stave (bass); fewer is a false positive.
    if (staveRun.length >= 4) {
      const staveTuning = tuningFor(staveRun, tuning).map((open) => open + capo);
      const local = readNotes(staveRun, staveTuning);
      const width = Math.max(...staveRun.map((l) => l.length), 0);

      blocks.push({
        id: nextId("stave"),
        kind: "stave",
        lines: staveRun,
        notes: local,
        width,
        columnOffset: offset,
        firstLine: staveStart,
        lineCount: staveRun.length,
      });
      for (const note of local) notes.push({ ...note, column: note.column + offset });
      offset += width;
    } else if (staveRun.length > 0) {
      if (textRun.length === 0) textStart = staveStart;
      textRun.push(...staveRun);
    }
    staveRun = [];
  };

  content.split(/\r?\n/).forEach((line, index) => {
    if (STAVE_LINE.test(line)) {
      if (staveRun.length === 0) {
        flushText();
        staveStart = index;
      }
      staveRun.push(line);
      return;
    }

    flushStave();

    const label = LABEL_LINE.exec(line);
    if (label) {
      flushText();
      blocks.push({
        id: nextId("label"),
        kind: "label",
        // Kept as written. The reader uppercases in CSS, and since the editor
        // shows this text in an input, folding the case here would delete an
        // uppercase letter the moment someone typed it.
        text: label[1] ?? "",
        firstLine: index,
        lineCount: 1,
      });
    } else {
      if (textRun.length === 0) textStart = index;
      textRun.push(line);
    }
  });

  flushStave();
  flushText();

  // Sort by column. The reader is built line by line, so notes come out
  // string-major — every note on the top string, then every note on the next,
  // and so on. A player walking that array in order sees time jump backwards at
  // every string change, and a scheduler that stops at the first note beyond its
  // lookahead never reaches the rest of a chord. String order breaks ties, so
  // the sequence is deterministic.
  notes.sort((a, b) => a.column - b.column || a.line - b.line);

  return { blocks, notes, totalColumns: offset };
}

/** A tab is playable when we found at least one note to play. */
export function isPlayable(content: string | null, tuning: string[] | null = null): boolean {
  return parseTabNotes(content, tuning).notes.length > 0;
}
