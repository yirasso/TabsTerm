import { describe, expect, it } from "vitest";
import { isPlayable, parseTabNotes, STANDARD_TUNING } from "./parse-notes";

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
    const { blocks } = parseTabNotes(`[intro]\n${STAVE}\n\nsome prose\n${STAVE}`);
    const staves = blocks.filter((b) => b.kind === "stave");
    const lines = `[intro]\n${STAVE}\n\nsome prose\n${STAVE}`.split("\n");
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

  it("keeps labels, prose and staves as separate ordered blocks", () => {
    const { blocks } = parseTabNotes(`[Intro]\nplay it softly\n${STAVE}`);
    expect(blocks.map((b) => b.kind)).toEqual(["label", "text", "stave"]);
    // Verbatim: the editor puts this text in an input, so folding its case
    // would eat an uppercase letter as it was typed.
    expect(blocks[0]).toMatchObject({ kind: "label", text: "Intro" });
  });

  it("says where every block starts and how many lines it holds", () => {
    const { blocks } = parseTabNotes(`[Intro]\n\nplay it softly\n${STAVE}`);
    // Removing a block splices these lines out, so prose has to own the blank
    // line above it — otherwise deleting the words leaves the gap behind.
    expect(blocks.map((b) => [b.firstLine, b.lineCount])).toEqual([
      [0, 1],
      [1, 2],
      [3, 6],
    ]);
  });

  it("gives every block a distinct id, even with repeated text", () => {
    const { blocks } = parseTabNotes("[Verse]\nsame\n\n[Verse]\nsame");
    const ids = blocks.map((b) => b.id);
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
