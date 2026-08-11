/**
 * Notes to string-and-fret positions.
 *
 * Pitch alone does not say where to play it — a middle E exists in five places
 * on a guitar neck. This is the disambiguation step, and the reason a note
 * detector on its own cannot produce tablature.
 *
 * The approach is deliberately a heuristic rather than a trained model: notes
 * are grouped into what is played together, and each group is placed as close
 * to the hand's last position as it can be, preferring open strings and low
 * frets. Good enough for the simple material people actually record; the
 * research-grade models stay in reserve.
 */

export type PitchEvent = {
  midi: number;
  /** Seconds from the start of the recording. */
  time: number;
  duration: number;
};

export type FrettedNote = {
  /** 0 = highest-pitched string, matching how tab lines are stacked. */
  string: number;
  fret: number;
  midi: number;
  time: number;
};

/** Notes closer together than this are treated as played at once. */
const CHORD_WINDOW_SECONDS = 0.06;
const MAX_FRET = 20;
/** How much a fret costs relative to moving the hand one fret. */
const POSITION_WEIGHT = 0.25;

function groupSimultaneous(events: PitchEvent[]): PitchEvent[][] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const groups: PitchEvent[][] = [];

  for (const event of sorted) {
    const last = groups.at(-1);
    const anchor = last?.[0];
    if (last && anchor && event.time - anchor.time <= CHORD_WINDOW_SECONDS) last.push(event);
    else groups.push([event]);
  }

  return groups;
}

/**
 * Place one group. Strings are handed out highest pitch to highest string,
 * which is how a hand actually falls on a chord, and each choice is scored
 * against where the hand already is.
 */
function placeGroup(group: PitchEvent[], tuning: number[], anchor: number): FrettedNote[] {
  const byPitch = [...group].sort((a, b) => b.midi - a.midi);
  const used = new Set<number>();
  const placed: FrettedNote[] = [];

  for (const event of byPitch) {
    let best: { string: number; fret: number; cost: number } | null = null;

    for (let string = 0; string < tuning.length; string++) {
      if (used.has(string)) continue;
      const open = tuning[string];
      if (open === undefined) continue;

      const fret = event.midi - open;
      if (fret < 0 || fret > MAX_FRET) continue;

      // An open string is free; otherwise pay for the fret and for the travel.
      const cost = fret === 0 ? 0 : fret * POSITION_WEIGHT + Math.abs(fret - anchor);
      if (!best || cost < best.cost) best = { string, fret, cost };
    }

    if (!best) continue; // Unreachable on this instrument; drop rather than lie.
    used.add(best.string);
    placed.push({ string: best.string, fret: best.fret, midi: event.midi, time: event.time });
  }

  return placed;
}

export function assignFrets(events: PitchEvent[], tuning: number[]): FrettedNote[] {
  const out: FrettedNote[] = [];
  let anchor = 0;

  for (const group of groupSimultaneous(events)) {
    const placed = placeGroup(group, tuning, anchor);
    out.push(...placed);

    // Move the hand to where the fretted notes actually were, ignoring open
    // strings, which say nothing about position.
    const fretted = placed.filter((n) => n.fret > 0).map((n) => n.fret);
    if (fretted.length > 0) {
      anchor = fretted.reduce((sum, f) => sum + f, 0) / fretted.length;
    }
  }

  return out.sort((a, b) => a.time - b.time || a.string - b.string);
}
