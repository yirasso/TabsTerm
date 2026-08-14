/**
 * Notes to string-and-fret positions.
 *
 * Pitch alone does not say where to play it — a middle E exists in five places
 * on a guitar neck. This is the disambiguation step, and the reason a note
 * detector on its own cannot produce tablature.
 *
 * Choosing note by note does not work, because the cost of a position is only
 * visible later: the cheapest place for this note is often the one that strands
 * the hand for the next bar. So both choices are made exactly rather than
 * greedily — within a chord, the best assignment of notes to strings; across
 * the piece, the best path the hand can take along the neck. The whole search
 * is small enough to run in milliseconds, and it is the difference between
 * tablature a guitarist recognises and one that jumps around the neck.
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
/** Frets the hand covers without shifting — four, or five with a stretch. */
const SPAN = 5;
const MAX_POSITION = MAX_FRET - SPAN + 1;

/** Leaving a note out. Dear enough that the hand will travel the neck first. */
const DROP_COST = 12;
/** Per fret of travel between one chord and the next. */
const MOVE_COST = 0.6;
/**
 * Per fret up the neck. Weighed against travel, not free: a player given the
 * same note low down and high up takes the low one, and only climbs when
 * staying put would cost more than the climb.
 */
const POSITION_COST = 0.2;
/** A fretted note against an open one, which costs nothing. */
const FRET_COST = 0.1;
/**
 * Per fret of stretch past what the hand covers. A reach is awkward, not
 * impossible — a thumb drops to a bass string, a finger stretches for one note
 * and comes back — so it is priced rather than forbidden. Anything past about
 * eight frets costs more than leaving the note out, which is the right answer
 * by then.
 */
const REACH_COST = 1.5;

/** Higher than this and a player would have retuned instead. */
const MAX_CAPO = 7;
/**
 * How much better a capo has to look before we claim there is one. Frets at the
 * second position are ordinary playing; reading them as a capo would put a
 * device on the neck that nobody used. Only a piece that is mostly open strings
 * once shifted clears this.
 */
const CAPO_MARGIN = 0.15;

/**
 * Which fret the capo is on, if any.
 *
 * A capo is why a recording can be in a key with no open strings in it and
 * still be easy to play: the guitarist moves the nut. Transcribing without
 * spotting one is the single worst thing that can happen to a tab, because
 * every note comes out as a barre high on the neck when the player was in first
 * position — right pitches, unrecognisable shapes.
 *
 * The tell is simple. Put the capo where it makes the most notes land on open
 * strings.
 */
export function detectCapo(events: PitchEvent[], tuning: number[]): number {
  if (events.length === 0) return 0;

  const openness = (capo: number): number => {
    let total = 0;
    for (const event of events) {
      let lowest = Number.POSITIVE_INFINITY;
      for (const open of tuning) {
        const fret = event.midi - (open + capo);
        if (fret >= 0 && fret <= MAX_FRET) lowest = Math.min(lowest, fret);
      }
      // Below the capo is not merely awkward, it cannot be played at all.
      if (!Number.isFinite(lowest)) total -= 1;
      else total += lowest === 0 ? 1 : Math.max(0, 0.4 - lowest / 30);
    }
    return total / events.length;
  };

  const none = openness(0);
  let bestCapo = 0;
  let bestScore = none;

  for (let capo = 1; capo <= MAX_CAPO; capo++) {
    const score = openness(capo);
    // Every candidate is judged against having no capo at all, never against
    // whichever one happens to be leading — otherwise accepting a weak capo
    // early raises the bar for the right one and it never gets in.
    if (score > none + CAPO_MARGIN && score > bestScore) {
      bestScore = score;
      bestCapo = capo;
    }
  }

  return bestCapo;
}

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

type Option = { string: number; fret: number };

/** Every place on the neck a pitch can be played, reachable or not. */
function optionsFor(midi: number, tuning: number[]): Option[] {
  const out: Option[] = [];
  for (let string = 0; string < tuning.length; string++) {
    const open = tuning[string];
    if (open === undefined) continue;
    const fret = midi - open;
    if (fret >= 0 && fret <= MAX_FRET) out.push({ string, fret });
  }
  return out;
}

/** What it costs to play `fret` with the hand at `position`. */
function reachCost(fret: number, position: number): number {
  // An open string is free from anywhere — it needs no hand at all.
  if (fret === 0) return 0;
  const beyond = Math.max(0, position - fret, fret - (position + SPAN - 1));
  return FRET_COST + beyond * REACH_COST;
}

/**
 * The cheapest way to play one group with the hand at `position`, and which
 * note goes where.
 *
 * Notes compete for strings, so this cannot be decided one note at a time
 * either: giving the top note the string it likes best can leave the note below
 * it nowhere to go. Exhaustive over (note, set of strings already taken), which
 * is at most a few hundred states for a six-string chord.
 */
function playGroup(
  options: Option[][],
  position: number,
  stringCount: number,
): { cost: number; picks: (Option | null)[] } {
  const cache = new Map<number, { cost: number; picks: (Option | null)[] }>();

  const from = (index: number, used: number): { cost: number; picks: (Option | null)[] } => {
    if (index === options.length) return { cost: 0, picks: [] };

    const key = index * (1 << stringCount) + used;
    const seen = cache.get(key);
    if (seen) return seen;

    const rest = from(index + 1, used);
    let best = { cost: rest.cost + DROP_COST, picks: [null as Option | null, ...rest.picks] };

    for (const option of options[index] ?? []) {
      const bit = 1 << option.string;
      if (used & bit) continue;

      const tail = from(index + 1, used | bit);
      const cost = tail.cost + reachCost(option.fret, position);
      if (cost < best.cost) best = { cost, picks: [option, ...tail.picks] };
    }

    cache.set(key, best);
    return best;
  };

  return from(0, 0);
}

/**
 * Where the hand should be for each group, chosen over the whole piece at once.
 *
 * A shift is only worth making if it pays off across the notes that follow, so
 * every position is carried forward for every group and the best path is read
 * back at the end.
 */
function handPath(groups: Option[][][], stringCount: number): number[] {
  const positions = Array.from({ length: MAX_POSITION }, (_, i) => i + 1);
  const previous: number[][] = [];
  let costs = positions.map(() => Number.POSITIVE_INFINITY);

  groups.forEach((group, index) => {
    const next = positions.map(() => Number.POSITIVE_INFINITY);
    const chosen = positions.map(() => 0);

    positions.forEach((position, p) => {
      const here = playGroup(group, position, stringCount).cost + position * POSITION_COST;

      if (index === 0) {
        next[p] = here;
        return;
      }

      positions.forEach((was, w) => {
        const total = (costs[w] ?? 0) + Math.abs(position - was) * MOVE_COST + here;
        if (total < (next[p] ?? Number.POSITIVE_INFINITY)) {
          next[p] = total;
          chosen[p] = w;
        }
      });
    });

    costs = next;
    previous.push(chosen);
  });

  // Walk the cheapest ending backwards to recover the positions that produced it.
  let at = 0;
  for (let p = 1; p < costs.length; p++) {
    if ((costs[p] ?? 0) < (costs[at] ?? 0)) at = p;
  }

  const path: number[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    path.unshift(positions[at] ?? 1);
    at = previous[index]?.[at] ?? 0;
  }
  return path;
}

export function assignFrets(events: PitchEvent[], tuning: number[]): FrettedNote[] {
  const groups = groupSimultaneous(events);
  if (groups.length === 0) return [];

  // Highest pitch first: it is the melody, and it should get first refusal on
  // the string it wants.
  const ordered = groups.map((group) => [...group].sort((a, b) => b.midi - a.midi));
  const options = ordered.map((group) => group.map((event) => optionsFor(event.midi, tuning)));

  const path = handPath(options, tuning.length);
  const out: FrettedNote[] = [];

  ordered.forEach((group, index) => {
    const { picks } = playGroup(options[index] ?? [], path[index] ?? 1, tuning.length);
    group.forEach((event, i) => {
      const pick = picks[i];
      // No pick means the pitch is off the instrument, or the strings it needed
      // were taken. Drop it rather than lie about where it was played.
      if (!pick) return;
      out.push({ string: pick.string, fret: pick.fret, midi: event.midi, time: event.time });
    });
  });

  return out.sort((a, b) => a.time - b.time || a.string - b.string);
}
