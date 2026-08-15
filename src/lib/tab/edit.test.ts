import { describe, expect, it } from "vitest";
import { appendBlock, blankStave, staveLabels, validateTab } from "./edit";
import { CELL_WIDTH, COLUMNS_PER_BAR } from "./grid";
import { parseTabNotes } from "./parse-notes";

describe("staveLabels", () => {
  it("uses standard labels when no tuning is declared", () => {
    expect(staveLabels(null)).toEqual(["e", "B", "G", "D", "A", "E"]);
  });

  it("reverses a declared tuning, since staves read high string first", () => {
    expect(staveLabels(["D", "A", "D", "G", "B", "E"])).toEqual(["e", "B", "G", "D", "A", "D"]);
  });

  it("falls back when the tuning has the wrong number of strings", () => {
    expect(staveLabels(["E", "A", "D"])).toEqual(["e", "B", "G", "D", "A", "E"]);
  });

  it("knows a four-string stave is a bass", () => {
    expect(staveLabels(null, 4)).toEqual(["G", "D", "A", "E"]);
  });
});

describe("blankStave", () => {
  it("produces one line per string, all the same length", () => {
    const lines = blankStave().split("\n");
    expect(lines).toHaveLength(6);
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it("starts each line with its string label and a bar", () => {
    expect(blankStave().split("\n")[0]).toMatch(/^e\|/);
  });
});

describe("blankStave, on the grid", () => {
  it("emits whole cells, so a new stave is already square", () => {
    const body = (blankStave().split("\n")[0] ?? "").slice(2).replace(/\|/g, "");
    expect(body.length % CELL_WIDTH).toBe(0);
  });

  it("writes bars the player counts as bars", () => {
    // A bar drawn every eight positions while the counter reads sixteen put two
    // bars on the page and one on the clock.
    const bars = (blankStave().split("\n")[0] ?? "").slice(2).split("|").filter(Boolean);
    expect(bars).toHaveLength(2);
    for (const bar of bars) expect(bar.length).toBe(COLUMNS_PER_BAR * CELL_WIDTH);
  });
});

describe("validateTab", () => {
  it("says nothing about a well-formed tab", () => {
    expect(validateTab(blankStave())).toEqual([]);
  });

  it("flags a stave whose lines are different lengths", () => {
    const issues = validateTab(`e|--0--|
B|--1|
G|--0--|
D|--2--|
A|--3--|
E|-----|`);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/align/);
  });

  it("flags a stave with too few strings", () => {
    const issues = validateTab("e|--0--|\nB|--1--|");
    expect(issues[0]?.message).toMatch(/at least 4/);
  });

  it("reports the line the stave starts on", () => {
    const issues = validateTab(`[Intro]

e|--0--|
B|--1|
G|--0--|
D|--2--|
A|--3--|
E|-----|`);
    expect(issues[0]?.line).toBe(3);
  });
});

describe("appendBlock", () => {
  it("leaves a blank line between blocks", () => {
    expect(appendBlock("hello", "world")).toBe("hello\n\nworld");
  });

  it("adds nothing in front of the first block", () => {
    expect(appendBlock("", "world")).toBe("world");
    expect(appendBlock("\n\n", "world")).toBe("world");
  });

  it("keeps two appended staves two staves", () => {
    // Without the blank line the parser reads one twelve-line stave: a stave is
    // a run of consecutive stave lines, so back-to-back staves fuse.
    const twice = appendBlock(appendBlock("", blankStave()), blankStave());
    const staves = parseTabNotes(twice).blocks.filter((b) => b.kind === "stave");

    expect(staves).toHaveLength(2);
    for (const stave of staves) expect(stave.lines).toHaveLength(6);
  });
});
