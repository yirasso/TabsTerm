import { describe, expect, it } from "vitest";
import { assignFrets, detectCapo, type PitchEvent } from "./fretting";
import { STANDARD_TUNING } from "./parse-notes";

const at = (midi: number, time: number): PitchEvent => ({ midi, time, duration: 0.25 });

/** A run of notes drawn from open strings and first-position frets. */
function firstPosition(shift: number): PitchEvent[] {
  const shapes = [0, 0, 1, 2, 3, 0, 2, 0, 1, 3, 0, 2];
  return STANDARD_TUNING.flatMap((open, s) =>
    shapes.map((fret, i) => at(open + fret + shift, s * 12 + i)),
  );
}

describe("detectCapo", () => {
  it("reports no capo when the playing already sits on open strings", () => {
    expect(detectCapo(firstPosition(0), STANDARD_TUNING)).toBe(0);
  });

  it("finds the capo that puts the playing back in first position", () => {
    // Not 5 or 7: the strings are a fourth apart, so shifting by a fourth lands
    // every string on its neighbour and the capo genuinely cannot be told from
    // no capo at all.
    for (const fret of [1, 2, 3, 6]) {
      expect(detectCapo(firstPosition(fret), STANDARD_TUNING)).toBe(fret);
    }
  });

  it("does not invent a capo when nothing suggests one", () => {
    // A chromatic run belongs to no key, so every capo position suits it
    // equally. With no reason to prefer one, claim none.
    const chromatic = Array.from({ length: 24 }, (_, i) => at(52 + i, i * 0.3));
    expect(detectCapo(chromatic, STANDARD_TUNING)).toBe(0);
  });

  it("says nothing about silence", () => {
    expect(detectCapo([], STANDARD_TUNING)).toBe(0);
  });
});

describe("assignFrets", () => {
  it("prefers an open string when the pitch allows one", () => {
    const [note] = assignFrets([at(64, 0)], STANDARD_TUNING);
    expect(note?.fret).toBe(0);
    expect(note?.string).toBe(0);
  });

  it("gives simultaneous notes different strings", () => {
    // An E minor shape struck together.
    const chord = assignFrets([at(64, 0), at(59, 0.01), at(55, 0.02)], STANDARD_TUNING);
    expect(chord).toHaveLength(3);
    expect(new Set(chord.map((n) => n.string)).size).toBe(3);
  });

  it("keeps the hand near where it already was", () => {
    // Climb to the twelfth fret, then play an F that is reachable at fret 1 on
    // the top string or fret 10 further down. The hand is already high, so the
    // high option should win.
    const notes = assignFrets([at(72, 0), at(74, 0.3), at(76, 0.6), at(65, 0.9)], STANDARD_TUNING);
    const last = notes.at(-1);
    expect(last?.fret).toBeGreaterThan(5);
  });

  it("still takes an open string from any hand position, since it costs nothing", () => {
    // Same climb, but the target has an open option. Reaching for it needs no
    // hand movement at all, so position should not talk us out of it.
    const notes = assignFrets([at(72, 0), at(74, 0.3), at(76, 0.6), at(64, 0.9)], STANDARD_TUNING);
    expect(notes.at(-1)?.fret).toBe(0);
  });

  it("drops pitches the instrument cannot reach rather than inventing them", () => {
    // Well below a guitar's low E.
    expect(assignFrets([at(20, 0)], STANDARD_TUNING)).toEqual([]);
  });

  it("never places a note past the twentieth fret", () => {
    const notes = assignFrets([at(100, 0)], STANDARD_TUNING);
    for (const note of notes) expect(note.fret).toBeLessThanOrEqual(20);
  });

  it("takes the low fret when the same pitch is available twice", () => {
    // An ascending arpeggio, every note reachable both on the top string low
    // down and on the string below it higher up. A guitarist plays it low.
    const notes = assignFrets([at(64, 0), at(67, 0.5), at(71, 1), at(76, 1.5)], STANDARD_TUNING);
    expect(notes.map((n) => n.fret)).toEqual([0, 3, 7, 12]);
  });

  it("returns notes in time order", () => {
    const notes = assignFrets([at(64, 1), at(59, 0), at(55, 0.5)], STANDARD_TUNING);
    const times = notes.map((n) => n.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("produces pitches that match what was asked for", () => {
    const wanted = [64, 60, 57, 52];
    const notes = assignFrets(
      wanted.map((m, i) => at(m, i * 0.5)),
      STANDARD_TUNING,
    );
    for (const note of notes) {
      expect((STANDARD_TUNING[note.string] ?? 0) + note.fret).toBe(note.midi);
    }
  });
});
