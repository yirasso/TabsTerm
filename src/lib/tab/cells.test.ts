import { describe, expect, it } from "vitest";
import {
  cellFret,
  EMPTY_CELL,
  fretText,
  readStave,
  removeLines,
  replaceLines,
  setCell,
  writeStave,
} from "./cells";
import { CELL_WIDTH } from "./grid";
import { parseTabNotes } from "./parse-notes";

/**
 * Fixtures are built from CELL_WIDTH rather than typed out. Widening the grid
 * once already meant rewriting every literal in this file, and a test that has
 * to be edited whenever the constant moves is testing the constant.
 */
const cells = (...text: string[]) => text.map((t) => t.padEnd(CELL_WIDTH, "-")).join("");
const line = (label: string, ...text: string[]) => `${label}|${cells(...text)}|`;

const SQUARE = [
  line("e", "0", "", "", ""),
  line("B", "", "3", "", ""),
  line("G", "", "", "", ""),
  line("D", "", "", "", ""),
];

describe("readStave", () => {
  it("reads a label and fixed-width cells", () => {
    const grid = readStave(SQUARE);
    expect(grid.labels).toEqual(["e|", "B|", "G|", "D|"]);
    expect(grid.cells[0]).toEqual([fretText(0), EMPTY_CELL, EMPTY_CELL, EMPTY_CELL]);
    expect(grid.cells[1]).toEqual([EMPTY_CELL, fretText(3), EMPTY_CELL, EMPTY_CELL]);
  });

  it("records where the bars are, including the one that closes the stave", () => {
    expect(readStave(SQUARE).bars).toEqual([4]);
    const two = ["e", "B", "G", "D"].map((l) => `${l}|${cells("")}|${cells("")}|`);
    expect(readStave(two).bars).toEqual([1, 2]);
  });

  it("keeps two-digit frets in one cell", () => {
    const grid = readStave(["e", "B", "G", "D"].map((l) => line(l, "12", "", "", "")));
    expect(grid.cells[0]?.[0]).toBe(fretText(12));
  });

  it("keeps technique marks rather than dropping what it does not understand", () => {
    const grid = readStave(["e", "B", "G", "D"].map((l) => line(l, "5h", "7", "", "")));
    expect(grid.cells[0]?.slice(0, 2)).toEqual(["5h".padEnd(CELL_WIDTH, "-"), fretText(7)]);
  });

  it("squares up ragged lines instead of refusing them", () => {
    // The case that makes hand-typed tab unreadable: lines of different lengths.
    const grid = readStave([
      `e|${cells("0", "", "3")}`,
      `B|${cells("0")}`,
      "G|",
      `D|${cells("0")}`,
    ]);
    expect(new Set(grid.cells.map((row) => row.length)).size).toBe(1);
    expect(grid.cells[1]).toEqual([fretText(0), EMPTY_CELL, EMPTY_CELL]);
  });

  it("gives every line a bar that any line has, so bars stay in a column", () => {
    const ragged = [
      `e|${cells("")}|${cells("")}`,
      `B|${cells("", "")}`,
      `G|${cells("", "")}`,
      `D|${cells("", "")}`,
    ];
    const written = writeStave(readStave(ragged));
    expect(written.every((l) => l.includes(`|${EMPTY_CELL}|`))).toBe(true);
  });
});

describe("writeStave", () => {
  it("is the inverse of reading a square stave", () => {
    expect(writeStave(readStave(SQUARE))).toEqual(SQUARE);
  });

  it("produces lines that all measure the same", () => {
    const ragged = [`e|${cells("0", "", "3")}`, `B|${cells("0")}`, "G|", `D|${cells("0")}`];
    const lines = writeStave(readStave(ragged));
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
    expect(lines[2]).toBe(line("G", "", "12", "", ""));
    // The point of the whole exercise: the other strings did not move.
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
    expect(lines[0]).toBe(SQUARE[0]);
  });

  it("clears a cell back to dashes", () => {
    const lines = writeStave(setCell(readStave(SQUARE), 0, 0, fretText(null)));
    expect(lines[0]).toBe(line("e", "", "", "", ""));
  });

  it("ignores coordinates that are not on the grid", () => {
    const grid = readStave(SQUARE);
    expect(setCell(grid, 9, 0, fretText(5))).toBe(grid);
    expect(setCell(grid, 0, 99, fretText(5))).toBe(grid);
    expect(setCell(grid, 0, -1, fretText(5))).toBe(grid);
  });
});

describe("fretText and cellFret", () => {
  it("writes one- and two-digit frets to the same width", () => {
    for (const fret of [0, 9, 12, 24]) expect(fretText(fret).length).toBe(CELL_WIDTH);
    expect(fretText(12).startsWith("12")).toBe(true);
  });

  it("leaves a dash after a two-digit fret, so two in a row stay apart", () => {
    // The reason the grid is wider than a fret: `12` beside `12` must not read
    // as `1212`.
    expect(fretText(12) + fretText(12)).toContain("12-12");
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
    const content = `intro\n${SQUARE.join("\n")}\nplay it softly`;
    const swapped = SQUARE.map((_, i) => line("eBGD"[i] ?? "e", "5", "", "", ""));
    const out = replaceLines(content, 1, SQUARE.length, swapped);

    expect(out.split("\n")[0]).toBe("intro");
    expect(out.split("\n")[1]).toBe(swapped[0]);
    expect(out.split("\n").at(-1)).toBe("play it softly");
  });
});

describe("removeLines", () => {
  it("takes a block's own lines and nothing else", () => {
    const content = `intro\n${SQUARE.join("\n")}\nplay it softly`;
    expect(removeLines(content, 0, 1)).toBe(`${SQUARE.join("\n")}\nplay it softly`);
  });

  it("leaves a blank line where the cut would weld two staves together", () => {
    // Adjacent stave lines are one stave, so splicing the prose out from
    // between two of them would silently make a single twelve-string stave.
    const content = `${SQUARE.join("\n")}\n\nprose\n\n${SQUARE.join("\n")}`;
    const out = removeLines(content, SQUARE.length, 3);

    expect(out.split("\n")).toHaveLength(SQUARE.length * 2 + 1);
    expect(out).not.toContain("prose");
    expect(parseTabNotes(out).blocks.filter((b) => b.kind === "stave")).toHaveLength(2);
  });
});
