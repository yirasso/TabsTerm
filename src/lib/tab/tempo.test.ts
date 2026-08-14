import { describe, expect, it } from "vitest";
import { detectTempo, STEPS_PER_BEAT, toStep } from "./tempo";

/** Onsets on a perfect grid at `bpm`, `every` sixteenths apart. */
function grid(bpm: number, count: number, every = 2, jitter = 0) {
  const step = 60 / (bpm * STEPS_PER_BEAT);
  return Array.from(
    { length: count },
    (_, i) => i * every * step + (jitter ? Math.sin(i * 12.9898) * jitter : 0),
  );
}

describe("detectTempo", () => {
  it("finds the grid the playing sits on", () => {
    // Onsets alone cannot say whether an even stream is eighths at 120 or
    // quarters at 60 — only that the spacing is 250ms. What must be right is
    // the step size, expressed as some power-of-two reading of it.
    const tempo = detectTempo(grid(120, 40));
    const ratio = 0.25 / tempo.secondsPerStep;
    expect(Math.log2(ratio) % 1).toBeCloseTo(0, 5);
  });

  it("leaves room to tell an eighth from a sixteenth", () => {
    // The reading where every note lands on consecutive steps is unreadable:
    // no gap means no rhythm on the page.
    const onsets = grid(120, 40);
    const tempo = detectTempo(onsets);
    const gap = (onsets[1] ?? 0) / tempo.secondsPerStep;
    expect(gap).toBeGreaterThanOrEqual(2);
  });

  it("does not run away to the finest grid it is allowed", () => {
    // The trap: closeness alone always improves as the grid gets finer, so a
    // naive search calls a steady 100bpm piece a stream of sixty-fourths.
    const tempo = detectTempo(grid(100, 40));
    expect(tempo.bpm).toBeLessThan(160);
    expect(tempo.bpm).toBeGreaterThan(60);
  });

  it("reports a tempo people count in", () => {
    // Slow playing is the same grid as fast playing an octave up; either way
    // the answer should be readable.
    for (const bpm of [50, 75, 140, 190]) {
      const found = detectTempo(grid(bpm, 40));
      expect(found.bpm).toBeGreaterThanOrEqual(60);
      expect(found.bpm).toBeLessThanOrEqual(180);
    }
  });

  it("survives a player who is not a metronome", () => {
    const tempo = detectTempo(grid(96, 60, 2, 0.02));
    expect(tempo.confidence).toBeGreaterThan(1.2);
  });

  it("is not confident about onsets with no pulse", () => {
    const scattered = Array.from({ length: 40 }, (_, i) => i * 0.31 + Math.sin(i * 7.3) * 0.15);
    const tempo = detectTempo(scattered);
    expect(tempo.confidence).toBeLessThan(2);
  });

  it("falls back rather than guessing from almost nothing", () => {
    const tempo = detectTempo([0, 1]);
    expect(tempo.confidence).toBe(0);
    expect(tempo.bpm).toBe(96);
  });
});

describe("toStep", () => {
  it("puts a note on the grid position it was played at", () => {
    const onsets = grid(120, 8);
    const tempo = detectTempo(onsets);
    const steps = onsets.map((t) => toStep(t, tempo));

    // Eighth notes: every other sixteenth.
    const gaps = steps.slice(1).map((v, i) => v - (steps[i] ?? 0));
    expect(new Set(gaps).size).toBe(1);
  });

  it("never returns a negative column", () => {
    const tempo = detectTempo(grid(120, 8));
    expect(toStep(-5, tempo)).toBe(0);
  });

  it("collapses notes struck together onto one column", () => {
    const tempo = detectTempo(grid(120, 8));
    // Three notes of a chord, a few milliseconds apart.
    expect(new Set([1.0, 1.01, 1.02].map((t) => toStep(t, tempo))).size).toBe(1);
  });
});
