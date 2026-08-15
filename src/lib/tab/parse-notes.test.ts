import { describe, expect, it } from "vitest";
import { BARS_PER_STAVE, CELL_WIDTH, COLUMNS_PER_BAR } from "./grid";
import {
  barAtColumn,
  isPlayable,
  parseTabNotes,
  STANDARD_TUNING,
  staveAtColumn,
} from "./parse-notes";

// Every line is 11 characters: the `e|` label plus nine of stave.
const STAVE = `e|--0--3--|
B|--1-----|
G|--0--0--|
D|--2-----|
A|--3-----|
E|--------|`;
const STAVE_WIDTH = 11;
/** First fret column — index 4, after the two label characters and two dashes. */
const FIRST = 4;

/** The `e|` a stave line opens with: two characters that are not notation. */
const LABEL_WIDTH = 2;
const BAR_CHARS = COLUMNS_PER_BAR * CELL_WIDTH;
/** A stave as everything in the product writes one: `BARS_PER_STAVE` full bars. */
const HOUSE_STAVE = ["e", "B", "G", "D", "A", "E"]
  .map((string) => `${string}|${`${"-".repeat(BAR_CHARS)}|`.repeat(BARS_PER_STAVE)}`)
  .join("\n");
const HOUSE_WIDTH = LABEL_WIDTH + BARS_PER_STAVE * (BAR_CHARS + 1);

describe("parseTabNotes", () => {
  it("returns nothing for empty content", () => {
    expect(parseTabNotes(null).notes).toEqual([]);
    expect(parseTabNotes("").blocks).toEqual([]);
  });

  it("reads frets off a stave and turns them into pitches", () => {
    const { notes } = parseTabNotes(STAVE);
    // Open high E on the top line.
    expect(notes).toContainEqual({ column: FIRST, line: 0, fret: 0, midi: STANDARD_TUNING[0] });
    // Third fret on the A string.
    expect(notes).toContainEqual({
      column: FIRST,
      line: 4,
      fret: 3,
      midi: (STANDARD_TUNING[4] ?? 0) + 3,
    });
  });

  it("sounds a capo'd tab where the capo puts it", () => {
    // The page says fret 0 on the top string; with a capo on 2 that sounds F#4,
    // not E4. Tab is written relative to the capo, so the written number and the
    // pitch that comes out are not the same thing.
    const { notes } = parseTabNotes(STAVE, null, 2);
    const top = notes.find((n) => n.line === 0);
    expect(top?.fret).toBe(0);
    expect(top?.midi).toBe((STANDARD_TUNING[0] ?? 0) + 2);
  });

  it("says which line of the source each stave starts on", () => {
    // An editor writing a stave back needs to find it again; searching for it
    // by content would pick the wrong one when two staves are identical.
    const source = `intro\n${STAVE}\n\nsome prose\n${STAVE}`;
    const { blocks } = parseTabNotes(source);
    const staves = blocks.filter((b) => b.kind === "stave");
    const lines = source.split("\n");
    for (const stave of staves) {
      expect(lines[stave.firstLine]).toBe(stave.lines[0]);
    }
    expect(staves).toHaveLength(2);
  });

  it("reads two-digit frets as one note, not two", () => {
    const { notes } = parseTabNotes(`e|--12--|
B|------|
G|------|
D|------|
A|------|
E|------|`);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.fret).toBe(12);
    expect(notes[0]?.column).toBe(FIRST);
  });

  it("ignores frets beyond a real fretboard", () => {
    const { notes } = parseTabNotes(`e|--99--|
B|------|
G|------|
D|------|
A|------|
E|------|`);
    expect(notes).toEqual([]);
  });

  it("keeps prose and staves as separate ordered blocks", () => {
    const { blocks } = parseTabNotes(`play it softly\n${STAVE}`);
    expect(blocks.map((b) => b.kind)).toEqual(["text", "stave"]);
  });

  it("has no notion of a section — a bracketed line is just words", () => {
    // Sections are gone. `[Intro]` is not punctuation the parser knows, so it
    // reads as the prose it looks like rather than becoming a heading.
    const { blocks } = parseTabNotes(`[Intro]\n${STAVE}`);
    expect(blocks[0]).toMatchObject({ kind: "text", text: "[Intro]" });
  });

  it("says where every block starts and how many lines it holds", () => {
    const { blocks } = parseTabNotes(`${STAVE}\n\nplay it softly`);
    // Removing a block splices these lines out, so prose has to own the blank
    // line above it — otherwise deleting the words leaves the gap behind.
    expect(blocks.map((b) => [b.firstLine, b.lineCount])).toEqual([
      [0, 6],
      [6, 2],
    ]);
  });

  it("gives every block a distinct id, even with repeated text", () => {
    const { blocks } = parseTabNotes(`same\n${STAVE}\n\nsame`);
    const ids = blocks.map((b) => b.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns notes in time order, not string order", () => {
    // A player walks this array and stops at the first note beyond its
    // lookahead. String-major order makes time jump backwards at every string
    // change, so the rest of a chord never gets scheduled.
    const { notes } = parseTabNotes(`e|--0---3---|
B|--1---0---|
G|--0---0---|
D|--2---0---|
A|--3---2---|
E|------3---|`);

    const columns = notes.map((n) => n.column);
    expect(columns).toEqual([...columns].sort((a, b) => a - b));
  });

  it("keeps a chord's notes together and in string order", () => {
    const { notes } = parseTabNotes(`e|--0--|
B|--1--|
G|--2--|
D|-----|
A|-----|
E|-----|`);
    expect(notes.map((n) => n.line)).toEqual([0, 1, 2]);
    expect(new Set(notes.map((n) => n.column)).size).toBe(1);
  });

  it("lays consecutive staves end to end on one timeline", () => {
    const { blocks, notes, totalColumns } = parseTabNotes(`${STAVE}\n\n${STAVE}`);
    const staves = blocks.flatMap((b) => (b.kind === "stave" ? [b] : []));

    expect(staves).toHaveLength(2);
    expect(staves[0]?.columnOffset).toBe(0);
    expect(staves[1]?.columnOffset).toBe(STAVE_WIDTH);
    expect(totalColumns).toBe(STAVE_WIDTH * 2);
    // The second stave's notes are shifted, so playback runs straight through.
    expect(notes.some((n) => n.column >= STAVE_WIDTH)).toBe(true);
  });

  it("counts bars off COLUMNS_PER_BAR, not by dividing the line length", () => {
    // A stave line carries characters that are not notation: the `e|` label and
    // a bar line closing every bar. Two bars measure 100 characters, not 96, so
    // dividing the character total by a bar width said three bars per stave —
    // and the reader offered five bars of a four-bar tab.
    const { blocks, totalBars } = parseTabNotes(`${HOUSE_STAVE}\n\n${HOUSE_STAVE}`);
    const staves = blocks.flatMap((b) => (b.kind === "stave" ? [b] : []));

    expect(staves.map((s) => s.width)).toEqual([HOUSE_WIDTH, HOUSE_WIDTH]);
    expect(staves.map((s) => s.barStarts.length)).toEqual([BARS_PER_STAVE, BARS_PER_STAVE]);
    // The running offset is what lets a second stave keep counting rather than
    // start again at one.
    expect(staves.map((s) => s.barOffset)).toEqual([0, BARS_PER_STAVE]);
    expect(totalBars).toBe(BARS_PER_STAVE * 2);
  });

  it("treats a run shorter than four lines as prose, not a stave", () => {
    const { blocks } = parseTabNotes("e|--0--|\nB|--1--|");
    expect(blocks.every((b) => b.kind !== "stave")).toBe(true);
  });

  it("honours a declared tuning that matches the stave labels", () => {
    const dropD = `e|------|
B|------|
G|------|
D|------|
A|------|
D|--0---|`;
    const { notes } = parseTabNotes(dropD, ["D", "A", "D", "G", "B", "E"]);
    // Low D sits two semitones below standard low E.
    expect(notes[0]?.midi).toBe((STANDARD_TUNING[5] ?? 0) - 2);
  });

  it("falls back to standard tuning when the labels disagree", () => {
    const { notes } = parseTabNotes(STAVE, ["D", "A", "D", "G", "A", "D"]);
    expect(notes[0]?.midi).toBe(STANDARD_TUNING[0]);
  });

  it("handles CRLF content", () => {
    const { notes } = parseTabNotes(STAVE.replace(/\n/g, "\r\n"));
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe("barAtColumn", () => {
  const parsed = parseTabNotes(`${HOUSE_STAVE}\n\n${HOUSE_STAVE}`);

  it("is nought before the cursor exists", () => {
    expect(barAtColumn(parsed, -1)).toBe(0);
  });

  it("puts the label characters in the bar they open", () => {
    // The cursor crosses `e|` on its way into the stave. Those columns are not
    // a bar of their own, so the counter must not blink through a nought.
    expect(barAtColumn(parsed, 0)).toBe(1);
    expect(barAtColumn(parsed, LABEL_WIDTH)).toBe(1);
  });

  it("turns the bar where the bar line is written", () => {
    expect(barAtColumn(parsed, LABEL_WIDTH + BAR_CHARS - 1)).toBe(1);
    // The bar line itself closes the bar it follows rather than opening one.
    expect(barAtColumn(parsed, LABEL_WIDTH + BAR_CHARS)).toBe(1);
    expect(barAtColumn(parsed, LABEL_WIDTH + BAR_CHARS + 1)).toBe(2);
  });

  it("keeps counting into the next stave", () => {
    expect(barAtColumn(parsed, HOUSE_WIDTH)).toBe(BARS_PER_STAVE + 1);
  });

  it("stays on the last bar once the cursor runs past the end", () => {
    // Playback keeps ticking after the final note, and "bar 5 / 4" is a lie.
    expect(barAtColumn(parsed, parsed.totalColumns * 2)).toBe(parsed.totalBars);
  });
});

describe("staveAtColumn", () => {
  const parsed = parseTabNotes(`${HOUSE_STAVE}\n\nsome words\n\n${HOUSE_STAVE}`);
  const staves = parsed.blocks.filter((b) => b.kind === "stave");

  it("is nothing while playback is stopped", () => {
    expect(staveAtColumn(parsed.blocks, -1)).toBeNull();
  });

  it("moves to the next stave as the cursor leaves the one before", () => {
    const first = staves[0];
    const second = staves[1];
    expect(staveAtColumn(parsed.blocks, 0)?.id).toBe(first?.id);
    expect(staveAtColumn(parsed.blocks, HOUSE_WIDTH - 1)?.id).toBe(first?.id);
    // The crossing the autoscroll hangs on: one column later it is a different
    // stave, and a different id, which is what makes the page follow.
    expect(staveAtColumn(parsed.blocks, HOUSE_WIDTH)?.id).toBe(second?.id);
  });

  it("skips the prose between them, which has no cursor to hold", () => {
    const ids = parsed.blocks.filter((b) => b.kind === "text").map((b) => b.id);
    for (let column = 0; column < parsed.totalColumns; column++) {
      expect(ids).not.toContain(staveAtColumn(parsed.blocks, column)?.id);
    }
  });

  it("is nothing once the cursor runs past the end", () => {
    expect(staveAtColumn(parsed.blocks, parsed.totalColumns * 2)).toBeNull();
  });
});

describe("isPlayable", () => {
  it("is true when there is a stave with notes", () => {
    expect(isPlayable(STAVE)).toBe(true);
  });

  it("is false for a chord sheet with no stave", () => {
    expect(isPlayable("[Verse]\nAm      C       D\nsome lyrics here")).toBe(false);
  });

  it("is false for an empty stave", () => {
    expect(
      isPlayable(`e|------|
B|------|
G|------|
D|------|
A|------|
E|------|`),
    ).toBe(false);
  });
});
