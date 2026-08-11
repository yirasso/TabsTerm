import { describe, expect, it } from "vitest";
import { CELL_WIDTH, normaliseGrid } from "./grid";

const staveLines = (content: string) =>
  content.split("\n").filter((line) => /^[A-Ga-g]\|/.test(line));

describe("normaliseGrid", () => {
  it("leaves prose and labels alone", () => {
    const text = "[Intro]\nplay it softly";
    expect(normaliseGrid(text)).toBe(text);
  });

  it("gives every position two characters", () => {
    const out = normaliseGrid(`e|--0--|
B|-----|
G|-----|
D|-----|
A|-----|
E|-----|`);
    // Five positions plus the closing bar: 5 * 2 + 1 characters after the label.
    expect(staveLines(out)[0]).toBe("e|----0-----|");
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
