import { describe, expect, it } from "vitest";
import { assignFrets, type PitchEvent } from "./fretting";
import { parseTabNotes, STANDARD_TUNING } from "./parse-notes";
import { notesToAscii } from "./to-ascii";

const TUNING = ["E", "A", "D", "G", "B", "E"];
const at = (midi: number, time: number): PitchEvent => ({ midi, time, duration: 0.25 });

describe("notesToAscii", () => {
  it("returns nothing for no notes", () => {
    expect(notesToAscii([], { tuning: TUNING })).toBe("");
  });

  it("emits one line per string, all the same length", () => {
    const notes = assignFrets([at(64, 0), at(59, 0.25), at(55, 0.5)], STANDARD_TUNING);
    const lines = notesToAscii(notes, { tuning: TUNING }).split("\n");
    expect(lines).toHaveLength(6);
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it("round-trips: what it writes, the parser reads back", () => {
    const wanted = [64, 60, 57, 52];
    const notes = assignFrets(
      wanted.map((m, i) => at(m, i * 0.25)),
      STANDARD_TUNING,
    );
    const ascii = notesToAscii(notes, { tuning: TUNING });
    const parsed = parseTabNotes(ascii, TUNING);

    expect(parsed.notes.map((n) => n.midi).sort()).toEqual([...wanted].sort());
  });

  it("keeps the grid square when a two-digit fret appears", () => {
    const notes = assignFrets([at(76, 0), at(64, 0.5)], STANDARD_TUNING);
    const lines = notesToAscii(notes, { tuning: TUNING }).split("\n");
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it("spreads a long recording over several staves", () => {
    const notes = assignFrets(
      Array.from({ length: 20 }, (_, i) => at(64, i * 0.5)),
      STANDARD_TUNING,
    );
    const staves = notesToAscii(notes, { tuning: TUNING }).split("\n\n");
    expect(staves.length).toBeGreaterThan(1);
  });
});
