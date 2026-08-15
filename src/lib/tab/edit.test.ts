import { describe, expect, it } from "vitest";
import { blankStave, insertAt, staveLabels, validateTab } from "./edit";
import { CELL_WIDTH, COLUMNS_PER_BAR } from "./grid";

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

describe("insertAt", () => {
  it("puts the insert on its own lines", () => {
    const { value } = insertAt("hello", 5, "world");
    expect(value).toBe("hello\nworld\n");
  });

  it("does not add blank lines that are already there", () => {
    const { value } = insertAt("hello\n", 6, "world");
    expect(value).toBe("hello\nworld\n");
  });

  it("reports a caret sitting after the insert", () => {
    const { value, caret } = insertAt("ab", 2, "X");
    expect(value.slice(0, caret)).toBe("ab\nX\n");
  });
});
