"use client";

import type { PitchEvent } from "@/lib/tab/fretting";
import type { MonoAudio } from "./decode";

/**
 * Note detection with Spotify's Basic Pitch, running entirely in the browser.
 *
 * The model ships inside the npm package and is copied into /public at build
 * time, so nothing is fetched from a third party at runtime.
 */

export const MODEL_URL = "/models/basic-pitch/model.json";

/** Below this the detector is mostly reporting room noise. */
const ONSET_THRESHOLD = 0.5;
const FRAME_THRESHOLD = 0.3;
/** Frames, not seconds — anything shorter is a transient, not a note. */
const MIN_NOTE_FRAMES = 5;
/**
 * Drop the quietest detections. On a clean solo recording this changes little;
 * on anything noisier it is the difference between a tab and a smear, because
 * every stray resonance the model half-hears would otherwise become a fret.
 */
const MIN_AMPLITUDE = 0.25;
/** A guitar in standard tuning: low E up to the top string's high frets. */
const LOWEST_MIDI = 40;
const HIGHEST_MIDI = 88;
/**
 * The model sometimes hears a ringing string re-attack, reporting one struck
 * note as two. Left alone that becomes two frets side by side, which reads as a
 * note nobody played.
 *
 * A fixed time window is the wrong test — at 120bpm a genuine sixteenth-note
 * repeat is only 125ms — so the rule is physical instead: the same pitch cannot
 * start again while it is still sounding, because one string can only be in one
 * place. Anything overlapping its own tail is an artefact.
 */

export type NoteProgress = (percent: number) => void;

export async function detectNotes(
  audio: MonoAudio,
  onProgress: NoteProgress = () => {},
): Promise<PitchEvent[]> {
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } =
    await import("@spotify/basic-pitch");

  const model = new BasicPitch(MODEL_URL);

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  await model.evaluateModel(
    audio.samples,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    onProgress,
  );

  const notes = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, ONSET_THRESHOLD, FRAME_THRESHOLD, MIN_NOTE_FRAMES),
    ),
  );

  const kept = notes
    .filter(
      (note) =>
        note.amplitude >= MIN_AMPLITUDE &&
        note.pitchMidi >= LOWEST_MIDI &&
        note.pitchMidi <= HIGHEST_MIDI,
    )
    .map((note) => ({
      midi: note.pitchMidi,
      time: note.startTimeSeconds,
      duration: note.durationSeconds,
    }))
    .sort((a, b) => a.time - b.time);

  return dropRestrikes(kept);
}

/** Drop a note that starts while the same pitch is still ringing. */
export function dropRestrikes(events: PitchEvent[]): PitchEvent[] {
  const soundingUntil = new Map<number, number>();
  const out: PitchEvent[] = [];

  for (const event of events) {
    const until = soundingUntil.get(event.midi);
    if (until !== undefined && event.time < until) continue;
    soundingUntil.set(event.midi, event.time + event.duration);
    out.push(event);
  }

  return out;
}
