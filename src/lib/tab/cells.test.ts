import { describe, expect, it } from "vitest";
import {
  cellFret,
  EMPTY_CELL,
  fretText,
  readStave,
  replaceLines,
  setCell,
  writeStave,
} from "./cells";

const SQUARE = ["e|0-------|", "B|--3-----|", "G|--------|", "D|--------|"];

describe("readStave", () => {
  it("reads a label and two-character cells", () => {
    const grid = readStave(SQUARE);
    expect(grid.labels).toEqual(["e|", "B|", "G|", "D|"]);
    expect(grid.cells[0]).toEqual(["0-", "--", "--", "--"]);
    expect(grid.cells[1]).toEqual(["--", "3-", "--", "--"]);
  });

  it("records where the bars are, including the one that closes the stave", () => {
    expect(readStave(SQUARE).bars).toEqual([4]);
    expect(readStave(["e|--|--|", "B|--|--|", "G|--|--|", "D|--|--|"]).bars).toEqual([1, 2]);
  });

  it("keeps two-digit frets in one cell", () => {
    const grid = readStave(["e|12------|", "B|--------|", "G|--------|", "D|--------|"]);
    expect(grid.cells[0]?.[0]).toBe("12");
  });

  it("keeps technique marks rather than dropping what it does not understand", () => {
    const grid = readStave(["e|5h7-----|", "B|--------|", "G|--------|", "D|--------|"]);
    expect(grid.cells[0]).toEqual(["5h", "7-", "--", "--"]);
  });

  it("squares up ragged lines instead of refusing them", () => {
    // The case that makes hand-typed tab unreadable: lines of different lengths.
    const grid = readStave(["e|0-3", "B|0", "G|", "D|0-3-5-"]);
    expect(new Set(grid.cells.map((row) => row.length)).size).toBe(1);
    expect(grid.cells[1]).toEqual(["0-", EMPTY_CELL, EMPTY_CELL]);
  });

  it("gives every line a bar that any line has, so bars stay in a column", () => {
    const grid = readStave(["e|--|--", "B|-----", "G|-----", "D|-----"]);
    expect(writeStave(grid).every((line) => line.includes("|--|"))).toBe(true);
  });
});

describe("writeStave", () => {
  it("is the inverse of reading a square stave", () => {
    expect(writeStave(readStave(SQUARE))).toEqual(SQUARE);
  });

  it("produces lines that all measure the same", () => {
    const lines = writeStave(readStave(["e|0-3", "B|0", "G|", "D|0-3-5-"]));
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it("survives a round trip unchanged, however many times it runs", () => {
    const once = writeStave(readStave(SQUARE));
    expect(writeStave(readStave(once))).toEqual(once);
  });
});

describe("setCell", () => {
  it("writes a fret without moving anything else", () => {
    const grid = setCell(readStave(SQUARE), 2, 1, fretText(12));
    const lines = writeStave(grid);
    expect(lines[2]).toBe("G|--12----|");
    // The point of the whole exercise: the other strings did not move.
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
    expect(lines[0]).toBe(SQUARE[0]);
  });

  it("clears a cell back to dashes", () => {
    const lines = writeStave(setCell(readStave(SQUARE), 0, 0, fretText(null)));
    expect(lines[0]).toBe("e|--------|");
  });

  it("ignores coordinates that are not on the grid", () => {
    const grid = readStave(SQUARE);
    expect(setCell(grid, 9, 0, "5-")).toBe(grid);
    expect(setCell(grid, 0, 99, "5-")).toBe(grid);
    expect(setCell(grid, 0, -1, "5-")).toBe(grid);
  });
});

describe("fretText and cellFret", () => {
  it("writes one- and two-digit frets to the same width", () => {
    expect(fretText(0)).toBe("0-");
    expect(fretText(9)).toBe("9-");
    expect(fretText(12)).toBe("12");
    expect(fretText(0).length).toBe(fretText(12).length);
  });

  it("refuses frets that are not on a neck", () => {
    expect(fretText(25)).toBe(EMPTY_CELL);
    expect(fretText(-1)).toBe(EMPTY_CELL);
  });

  it("reads back what it wrote", () => {
    for (const fret of [0, 5, 9, 12, 24]) expect(cellFret(fretText(fret))).toBe(fret);
  });

  it("has no fret for an empty cell or a technique mark", () => {
    expect(cellFret(EMPTY_CELL)).toBeNull();
    expect(cellFret("h-")).toBeNull();
    expect(cellFret(undefined)).toBeNull();
  });
});

describe("replaceLines", () => {
  it("swaps a stave without disturbing what surrounds it", () => {
    const content = "[intro]\ne|0-|\nB|--|\nG|--|\nD|--|\nplay it softly";
    const out = replaceLines(content, 1, 4, ["e|5-|", "B|--|", "G|--|", "D|--|"]);
    expect(out.split("\n")[0]).toBe("[intro]");
    expect(out.split("\n")[1]).toBe("e|5-|");
    expect(out.split("\n")[5]).toBe("play it softly");
  });
});
