import { describe, expect, it } from "vitest";
import { CELL_WIDTH, normaliseGrid, regrid } from "./grid";

const staveLines = (content: string) =>
  content.split("\n").filter((line) => /^[A-Ga-g]\|/.test(line));

describe("normaliseGrid", () => {
  it("leaves prose and labels alone", () => {
    const text = "[Intro]\nplay it softly";
    expect(normaliseGrid(text)).toBe(text);
  });

  it("gives every position the same width", () => {
    const out = normaliseGrid(`e|--0--|
B|-----|
G|-----|
D|-----|
A|-----|
E|-----|`);
    // Five source positions, each re-laid to CELL_WIDTH, plus the closing bar.
    const expected = `e|${["", "", "0", "", ""].map((c) => c.padEnd(CELL_WIDTH, "-")).join("")}|`;
    expect(staveLines(out)[0]).toBe(expected);
  });

  it("makes a two-digit fret measure the same as a one-digit one", () => {
    const out = normaliseGrid(`e|--0--12--|
B|---------|
G|---------|
D|---------|
A|---------|
E|---------|`);
    const [top = "", second = ""] = staveLines(out);
    expect(top.length).toBe(second.length);
    expect(top).toContain("0-");
    expect(top).toContain("12");
  });

  it("stops a wide fret from stealing the next time position", () => {
    // Written one character per position, `12` eats the slot after it. Once
    // normalised, every mark must sit on a cell boundary — which is what makes
    // the position after a wide fret land where it should.
    const out = normaliseGrid(`e|-0--12--3-|
B|----------|
G|----------|
D|----------|
A|----------|
E|----------|`);
    const body = (staveLines(out)[0] ?? "").slice(2).replace(/\|/g, "");
    const marks = [...body.matchAll(/\d+/g)].map((m) => m.index);

    expect(marks).toHaveLength(3);
    for (const at of marks) expect(at % CELL_WIDTH).toBe(0);
    // The three notes were two positions apart in the source; still are.
    expect((marks[1] ?? 0) - (marks[0] ?? 0)).toBe((marks[2] ?? 0) - (marks[1] ?? 0));
  });

  it("keeps every line of a stave the same length", () => {
    const out = normaliseGrid(`e|--12--|
B|--0---|
G|------|
D|--7---|
A|------|
E|------|`);
    expect(new Set(staveLines(out).map((l) => l.length)).size).toBe(1);
  });

  it("keeps bar lines aligned and one character wide", () => {
    const out = normaliseGrid(`e|--0--|--3--|
B|-----|-----|
G|-----|-----|
D|-----|-----|
A|-----|-----|
E|-----|-----|`);
    const positions = staveLines(out).map((line) => [...line.matchAll(/\|/g)].map((m) => m.index));
    // Every string agrees on where the bars are.
    expect(new Set(positions.map((p) => p.join(","))).size).toBe(1);
  });

  it("preserves technique markers", () => {
    const out = normaliseGrid(`e|--5h7--|
B|-------|
G|-------|
D|-------|
A|-------|
E|-------|`);
    const top = staveLines(out)[0] ?? "";
    expect(top).toContain("5-");
    expect(top).toContain("h-");
    expect(top).toContain("7-");
  });

  it("is idempotent — normalising twice changes nothing", () => {
    const once = normaliseGrid(`e|--0--12--|
B|---------|
G|---------|
D|---------|
A|---------|
E|---------|`);
    expect(normaliseGrid(once)).toBe(once);
  });

  it("normalises each stave independently", () => {
    const out = normaliseGrid(`e|--0--|
B|-----|
G|-----|
D|-----|
A|-----|
E|-----|

e|--12--|
B|------|
G|------|
D|------|
A|------|
E|------|`);
    const [first = "", second = ""] = out.split("\n\n");
    expect(new Set(staveLines(first).map((l) => l.length)).size).toBe(1);
    expect(new Set(staveLines(second).map((l) => l.length)).size).toBe(1);
  });

  it("uses the declared cell width", () => {
    const out = normaliseGrid(`e|-0-|
B|---|
G|---|
D|---|
A|---|
E|---|`);
    // Three positions, each CELL_WIDTH wide, plus the closing bar.
    expect((staveLines(out)[0] ?? "").length).toBe(2 + 3 * CELL_WIDTH + 1);
  });
});

describe("regrid", () => {
  // A stave written when a position was two characters wide.
  const OLD = `[intro]
e|0-12--|
B|--3---|
G|------|
D|------|
play it softly`;

  it("reads each old cell whole instead of one character at a time", () => {
    const out = regrid(OLD, 2);
    const top = staveLines(out)[0] ?? "";

    // Three positions in, three positions out. normaliseGrid would have made
    // six, because it treats every character column as a position.
    expect(top.slice(2).replace(/\|/g, "").length).toBe(3 * CELL_WIDTH);
    expect(top).toBe(`e|${["0", "12", ""].map((c) => c.padEnd(CELL_WIDTH, "-")).join("")}|`);
  });

  it("keeps frets on the position they were written on", () => {
    const lines = staveLines(regrid(OLD, 2));
    const at = (line: string, fret: string) => line.slice(2).replace(/\|/g, "").indexOf(fret);

    expect(at(lines[0] ?? "", "12")).toBe(1 * CELL_WIDTH);
    expect(at(lines[1] ?? "", "3")).toBe(1 * CELL_WIDTH);
  });

  it("leaves prose, labels and bar lines where they were", () => {
    const out = regrid(OLD, 2).split("\n");
    expect(out[0]).toBe("[intro]");
    expect(out.at(-1)).toBe("play it softly");
    for (const line of staveLines(regrid(OLD, 2))) expect(line.endsWith("|")).toBe(true);
  });

  it("squares the stave up", () => {
    const lengths = new Set(staveLines(regrid(OLD, 2)).map((l) => l.length));
    expect(lengths.size).toBe(1);
  });

  it("is a no-op when the width has not moved", () => {
    const already = regrid(OLD, 2);
    expect(regrid(already, CELL_WIDTH)).toBe(already);
  });
});
