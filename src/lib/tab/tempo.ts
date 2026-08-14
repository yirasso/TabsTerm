/**
 * Finding the beat, so a transcription lands on a musical grid.
 *
 * A note detector gives times in seconds, and those times carry every hesitation
 * and rush of the performance. Rendering them against a fixed number of columns
 * per second turns that jitter into noise: notes an even eighth apart land two
 * or three columns apart depending on how the player felt, and the tab has no
 * readable rhythm at all.
 *
 * So: work out the tempo the player was actually keeping, then place every note
 * on the nearest sixteenth. What comes out is a tab someone can count.
 */

/** A performance slower or faster than this is not what we are looking at. */
const MIN_BPM = 45;
const MAX_BPM = 200;
const BPM_STEP = 0.25;
/** Sixteenth notes — fine enough for fingerstyle, coarse enough to read. */
export const STEPS_PER_BEAT = 4;
/** How far off the grid an onset can be before it stops counting as aligned. */
const TOLERANCE_SECONDS = 0.05;

export type Tempo = {
  bpm: number;
  /** Where the grid starts, in seconds. */
  offset: number;
  secondsPerStep: number;
  /** 0–1: the share of onsets that landed on the grid. */
  confidence: number;
};

/**
 * How well onsets sit on a candidate grid, measured against how well they would
 * sit there by luck.
 *
 * Raw closeness is not usable on its own: a finer grid always fits better, so
 * maximising it walks straight to the fastest tempo allowed and calls a
 * quarter-note piece a stream of sixty-fourths. Dividing by what uniformly
 * random onsets would score on the same grid removes that bias, and what wins
 * is the coarsest grid that still explains the playing.
 */
function score(onsets: number[], secondsPerStep: number, offset: number): number {
  let total = 0;
  for (const time of onsets) {
    const steps = (time - offset) / secondsPerStep;
    const distance = Math.abs(steps - Math.round(steps)) * secondsPerStep;
    total += Math.exp(-((distance / TOLERANCE_SECONDS) ** 2));
  }

  // Expected score for random times on this grid. Once a step is narrower than
  // the tolerance every onset is "aligned", so the baseline saturates at 1.
  const chance = Math.min(1, (TOLERANCE_SECONDS * Math.sqrt(Math.PI)) / secondsPerStep);
  return total / onsets.length / chance;
}

/**
 * Search tempo and phase together. They are not separable — a grid at the right
 * speed but the wrong phase fits no better than one at the wrong speed.
 */
export function detectTempo(onsets: number[]): Tempo {
  const fallback: Tempo = {
    bpm: 96,
    offset: onsets[0] ?? 0,
    secondsPerStep: 60 / (96 * STEPS_PER_BEAT),
    confidence: 0,
  };
  if (onsets.length < 4) return fallback;

  let best = fallback;
  let bestScore = 0;

  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += BPM_STEP) {
    const secondsPerStep = 60 / (bpm * STEPS_PER_BEAT);

    // Phase only matters within one step; anything further is the same grid.
    const phases = 8;
    for (let p = 0; p < phases; p++) {
      const offset = (onsets[0] ?? 0) + (p / phases) * secondsPerStep;
      const value = score(onsets, secondsPerStep, offset);
      if (value > bestScore) {
        bestScore = value;
        best = { bpm, offset, secondsPerStep, confidence: value };
      }
    }
  }

  return inMusicalRange(best, onsets);
}

/** Median gap between onsets, measured in grid steps. */
function medianStepGap(onsets: number[], secondsPerStep: number): number {
  const gaps: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const gap = ((onsets[i] ?? 0) - (onsets[i - 1] ?? 0)) / secondsPerStep;
    if (gap > 0.25) gaps.push(gap);
  }
  if (gaps.length === 0) return 2;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 2;
}

/** Tempos people actually count in. */
const COMFORTABLE_MIN = 60;
const COMFORTABLE_MAX = 180;

/**
 * Tempo is only defined up to a factor of two: the same playing is 49bpm in
 * sixteenths, 98 in eighths or 195 in quarters, and the search has no way to
 * choose between them. Fold into the range people actually count in.
 *
 * Halving the step is always safe — it is a refinement, so every onset that sat
 * on the old grid still sits on the new one — and it gives the notation room to
 * tell an eighth from a sixteenth instead of cramming everything adjacent.
 */
function inMusicalRange(tempo: Tempo, onsets: number[]): Tempo {
  let { bpm, secondsPerStep } = tempo;

  while (bpm < COMFORTABLE_MIN) {
    bpm *= 2;
    secondsPerStep /= 2;
  }
  while (bpm > COMFORTABLE_MAX) {
    bpm /= 2;
    secondsPerStep *= 2;
  }

  // Among the octaves that remain, prefer the one that reads. If the ordinary
  // note lands on every step, the tab has no air in it and an eighth cannot be
  // told from a sixteenth; halving the step spaces it out. This is the only
  // part of the choice the audio genuinely cannot make for us, so it is settled
  // on the notation's terms.
  while (medianStepGap(onsets, secondsPerStep) < 2 && bpm * 2 <= COMFORTABLE_MAX) {
    bpm *= 2;
    secondsPerStep /= 2;
  }

  return { ...tempo, bpm: Math.round(bpm * 10) / 10, secondsPerStep };
}

/**
 * Snap a time to its grid step. Returns the step index, which becomes the
 * column — so one column is one sixteenth note rather than an arbitrary slice
 * of a second.
 */
export function toStep(time: number, tempo: Tempo): number {
  return Math.max(0, Math.round((time - tempo.offset) / tempo.secondsPerStep));
}
