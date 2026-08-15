"use client";

/**
 * Recording to draft tablature, in one call.
 *
 * The stages have to run in this order and it is not obvious why: the capo is
 * found before the fretting, because it decides which neck the notes are being
 * placed on, and the beat is found before the layout, because a column is a
 * sixteenth note rather than a slice of wall-clock time.
 *
 * Everything here runs in the browser on audio the user supplied. Nothing is
 * uploaded, and there is nothing kept afterwards.
 */

import { assignFrets, detectCapo } from "@/lib/tab/fretting";
import { tuningToMidi } from "@/lib/tab/parse-notes";
import { detectTempo } from "@/lib/tab/tempo";
import { notesToAscii } from "@/lib/tab/to-ascii";
import type { MonoAudio } from "./decode";

/** Two attacks closer than this are one moment, not two beats. */
const ONE_MOMENT_SECONDS = 0.05;
/** Below this the grid is a guess, so the tab does not claim a tempo. */
const TEMPO_WORTH_REPORTING = 1.2;

export type Transcription = {
  /** ASCII tablature with a heading, ready to drop into a draft. */
  content: string;
  capo: number;
  /** Null when the playing had no pulse clear enough to name. */
  bpm: number | null;
};

export type TranscribeProgress = {
  onStage?: (stage: string) => void;
  onPercent?: (percent: number) => void;
};

/** Thrown when there is nothing in the audio to write down. */
export class NothingHeard extends Error {}

export async function transcribeAudio(
  audio: MonoAudio,
  tuning: string[] | null,
  { onStage = () => {}, onPercent = () => {} }: TranscribeProgress = {},
): Promise<Transcription> {
  onStage("working out the notes…");
  const { detectNotes } = await import("./notes");
  const events = await detectNotes(audio, onPercent);
  if (events.length === 0) {
    throw new NothingHeard("no notes found — try playing louder or closer");
  }

  onStage("finding the beat…");
  // Chord notes share one attack, so the beat tracker should see moments rather
  // than every note — otherwise a six-note chord counts six times.
  const moments: number[] = [];
  for (const event of events) {
    const last = moments.at(-1);
    if (last === undefined || event.time - last > ONE_MOMENT_SECONDS) moments.push(event.time);
  }
  const tempo = detectTempo(moments);

  onStage("choosing strings and frets…");
  const open = tuningToMidi(tuning);
  const capo = detectCapo(events, open);
  const fretted = assignFrets(
    events,
    open.map((string) => string + capo),
  );
  if (fretted.length === 0) {
    throw new NothingHeard("nothing that fits on a guitar neck");
  }

  const names = tuning ?? ["E", "A", "D", "G", "B", "E"];
  const bpm = tempo.confidence > TEMPO_WORTH_REPORTING ? Math.round(tempo.bpm) : null;

  const heading = ["take 1"];
  if (bpm !== null) heading.push(`~${bpm} bpm`);
  if (capo > 0) heading.push(`capo ${capo}`);

  return {
    capo,
    bpm,
    // A plain line of prose, not a bracketed heading: there are no sections any
    // more, so brackets would only be punctuation nothing reads.
    content: `${heading.join(" · ")}\n${notesToAscii(fretted, { tuning: names, tempo })}`,
  };
}
