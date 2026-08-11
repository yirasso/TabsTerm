"use client";

import type { PitchEvent } from "@/lib/tab/fretting";
import type { MonoAudio } from "./decode";

/**
 * Note detection with Spotify's Basic Pitch, running entirely in the browser.
 *
 * This is via 3: the user records their own guitar, and we work out what they
 * played. It is the only path that yields real tablature — a full-band mix
 * cannot be separated into notes, which is why the file path gives chords
 * instead.
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

  return notes
    .map((note) => ({
      midi: note.pitchMidi,
      time: note.startTimeSeconds,
      duration: note.durationSeconds,
    }))
    .sort((a, b) => a.time - b.time);
}
