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
export type TabBlock = { id: string } & (
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
 * Pick the MIDI base for each line. When the stave's labels match the declared
 * tuning's note names we trust the tuning; otherwise fall back to standard,
 * which is what the overwhelming majority of tab uses.
 */
function tuningFor(lines: string[], declared: string[] | null): number[] {
  const fallback = lines.length === 4 ? BASS_TUNING : STANDARD_TUNING;
  if (!declared || declared.length !== lines.length) return fallback;

  // Tunings are written low string first; stave lines run high string first.
  const highFirst = [...declared].reverse();
  const labels = lines.map((l) => STAVE_LINE.exec(l)?.[1]?.toLowerCase() ?? "");
  const matches = highFirst.every((note, i) => note.slice(0, 1).toLowerCase() === labels[i]);
  if (!matches) return fallback;

  // Anchor to the fallback's octaves and shift by the declared pitch class, so
  // drop-D or DADGAD lands in the right register instead of an octave away.
  return highFirst.map((note, i) => {
    const base = fallback[i] ?? 40;
    const wanted = PITCH_CLASS[note.slice(0, 1).toLowerCase()];
    if (wanted === undefined) return base;
    const accidental = note.includes("#") ? 1 : note.includes("b") ? -1 : 0;
    const target = wanted + accidental;
    return target + Math.round((base - target) / 12) * 12;
  });
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

export function parseTabNotes(content: string | null, tuning: string[] | null = null): ParsedTab {
  const empty: ParsedTab = { blocks: [], notes: [], totalColumns: 0 };
  if (!content) return empty;

  const blocks: TabBlock[] = [];
  const notes: TabNote[] = [];
  let offset = 0;

  let staveRun: string[] = [];
  let textRun: string[] = [];

  const nextId = (kind: string) => `${kind}-${blocks.length}`;

  const flushText = () => {
    const text = textRun.join("\n").replace(/^\n+/, "").trimEnd();
    if (text) blocks.push({ id: nextId("text"), kind: "text", text });
    textRun = [];
  };

  const flushStave = () => {
    // Four lines is the smallest real stave (bass); fewer is a false positive.
    if (staveRun.length >= 4) {
      const staveTuning = tuningFor(staveRun, tuning);
      const local = readNotes(staveRun, staveTuning);
      const width = Math.max(...staveRun.map((l) => l.length), 0);

      blocks.push({
        id: nextId("stave"),
        kind: "stave",
        lines: staveRun,
        notes: local,
        width,
        columnOffset: offset,
      });
      for (const note of local) notes.push({ ...note, column: note.column + offset });
      offset += width;
    } else if (staveRun.length > 0) {
      textRun.push(...staveRun);
    }
    staveRun = [];
  };

  for (const line of content.split(/\r?\n/)) {
    if (STAVE_LINE.test(line)) {
      if (staveRun.length === 0) flushText();
      staveRun.push(line);
      continue;
    }

    flushStave();

    const label = LABEL_LINE.exec(line);
    if (label) {
      flushText();
      blocks.push({ id: nextId("label"), kind: "label", text: (label[1] ?? "").toLowerCase() });
    } else {
      textRun.push(line);
    }
  }

  flushStave();
  flushText();

  return { blocks, notes, totalColumns: offset };
}

/** A tab is playable when we found at least one note to play. */
export function isPlayable(content: string | null, tuning: string[] | null = null): boolean {
  return parseTabNotes(content, tuning).notes.length > 0;
}
