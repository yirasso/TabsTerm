import { describe, expect, it } from "vitest";
import { BARS_PER_STAVE, CELL_WIDTH, COLUMNS_PER_BAR } from "@/lib/tab/grid";
import { parseTabNotes } from "@/lib/tab/parse-notes";
import { seedTabs } from "./seed-tabs";

/** The widest a stave may be and still fit the reading column. */
const MAX_WIDTH = BARS_PER_STAVE * (COLUMNS_PER_BAR * CELL_WIDTH + 1);

describe("the shipped library", () => {
  it("has staves narrow enough to read without scrolling sideways", () => {
    // Nothing in the product writes a stave wider than this — `blankStave` and
    // `notesToAscii` both lay out BARS_PER_STAVE bars — so the library is the
    // one place it could be broken by hand. It was: these tabs were written
    // seventeen positions to the bar and scrolled in the reader.
    for (const tab of seedTabs) {
      for (const block of parseTabNotes(tab.content).blocks) {
        if (block.kind !== "stave") continue;
        expect(
          block.width,
          `${tab.id} has a stave ${block.width} characters wide`,
        ).toBeLessThanOrEqual(2 + MAX_WIDTH);
      }
    }
  });

  it("counts its bars the way the player does", () => {
    for (const tab of seedTabs) {
      for (const line of tab.content.split("\n")) {
        if (!/^[A-Ga-g]\|/.test(line)) continue;
        for (const bar of line.slice(2).split("|")) {
          if (bar === "") continue;
          expect(bar.length, `${tab.id}: bar of ${bar.length / CELL_WIDTH} positions`).toBe(
            COLUMNS_PER_BAR * CELL_WIDTH,
          );
        }
      }
    }
  });
});
