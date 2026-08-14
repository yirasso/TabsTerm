"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CELL_WIDTH } from "@/lib/tab/grid";
import { createGuitar, type Guitar } from "@/lib/tab/guitar";
import { type ParsedTab, parseTabNotes } from "@/lib/tab/parse-notes";

/** Notation positions in a beat: a sixteenth note each at the shown bpm. */
const POSITIONS_PER_BEAT = 4;
/**
 * Characters per beat. The parser reports a note's time as a character column,
 * so this has to be derived from `CELL_WIDTH` rather than written down — a
 * hard-coded 8 was correct only while a position was two characters wide, and
 * widening the grid without it would have slowed every tab down by half.
 */
const COLUMNS_PER_BEAT = POSITIONS_PER_BEAT * CELL_WIDTH;
/** Schedule this far ahead of the clock, so audio never starves. */
const LOOKAHEAD_SECONDS = 0.4;
const TICK_MS = 50;

const secondsPer = (bpm: number) => 60 / (bpm * COLUMNS_PER_BEAT);

export type PlaybackState = {
  parsed: ParsedTab;
  playable: boolean;
  playing: boolean;
  bpm: number;
  /** Column under the cursor, or -1 when stopped. */
  column: number;
  toggle: () => void;
  stop: () => void;
  setBpm: (next: number | ((prev: number) => number)) => void;
};

export function useTabPlayback(
  content: string | null,
  tuning: string[] | null,
  capo = 0,
): PlaybackState {
  const [parsed, setParsed] = useState<ParsedTab>(() => parseTabNotes(content, tuning, capo));
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(96);
  const [column, setColumn] = useState(-1);

  const ctxRef = useRef<AudioContext | null>(null);
  const guitarRef = useRef<Guitar | null>(null);
  const startedAtRef = useRef(0);
  const nextNoteRef = useRef(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    setParsed(parseTabNotes(content, tuning, capo));
  }, [content, tuning, capo]);

  const stop = useCallback(() => {
    setPlaying(false);
    setColumn(-1);
    nextNoteRef.current = 0;
    guitarRef.current?.stopAll();
  }, []);

  const toggle = useCallback(() => {
    if (playing) {
      stop();
      return;
    }
    if (parsed.notes.length === 0) return;

    // The AudioContext must be created from a gesture, or it starts suspended.
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      guitarRef.current = createGuitar(ctxRef.current);
    }
    void ctxRef.current.resume();

    nextNoteRef.current = 0;
    startedAtRef.current = ctxRef.current.currentTime + 0.1;
    setPlaying(true);
  }, [playing, stop, parsed.notes.length]);

  // Scheduler: hand the audio clock a little future at a time, and move the
  // cursor from that same clock so the two never drift apart.
  useEffect(() => {
    const ctx = ctxRef.current;
    const guitar = guitarRef.current;
    if (!playing || !ctx || !guitar) return;

    const notes = parsed.notes;

    const timer = setInterval(() => {
      // Read the tempo each tick rather than closing over it, so changing it
      // takes effect without tearing the scheduler down and restarting.
      const secondsPerColumn = secondsPer(bpmRef.current);
      const now = ctx.currentTime;
      const horizon = now + LOOKAHEAD_SECONDS;

      while (nextNoteRef.current < notes.length) {
        const note = notes[nextNoteRef.current];
        if (!note) break;
        const at = startedAtRef.current + note.column * secondsPerColumn;
        if (at > horizon) break;
        // A note whose moment has passed — the tab was scrolled or the tempo
        // jumped — is played now rather than dropped.
        guitar.pluck(note.midi, Math.max(at, now));
        nextNoteRef.current++;
      }

      const at = Math.floor((now - startedAtRef.current) / secondsPerColumn);
      // Also nudge the cursor from here. The frame loop below is what makes it
      // smooth, but it stops entirely when the page is not compositing — a
      // background tab, or a headless browser — and without this the cursor
      // would simply never appear there.
      setColumn(at);

      if (at > parsed.totalColumns && nextNoteRef.current >= notes.length) stop();
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [playing, parsed, stop]);

  // The cursor also moves once per frame, and this is the update that counts.
  //
  // Driving it only from the scheduler's 50ms tick left it visibly behind the
  // sound — a tick plus a React render is most of a column at any sensible
  // tempo, and the eye notices a note landing before the bar reaches it. A
  // frame callback runs immediately before paint, so the position drawn is the
  // position now. Both read the same audio clock and the same formula, so the
  // two writers can only ever agree.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!playing || !ctx) return;

    let frame = 0;
    const follow = () => {
      const at = Math.floor((ctx.currentTime - startedAtRef.current) / secondsPer(bpmRef.current));
      setColumn(at);
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);

    return () => cancelAnimationFrame(frame);
  }, [playing]);

  /**
   * Change tempo without losing your place: rebase the start time so the cursor
   * stays on its column and simply continues at the new rate, then re-point the
   * scheduler at the first note that has not been played yet.
   */
  const changeBpm = useCallback(
    (next: number | ((prev: number) => number)) => {
      const previous = bpmRef.current;
      const wanted = typeof next === "function" ? next(previous) : next;
      const value = Math.min(220, Math.max(40, wanted));
      if (value === previous) return;

      const ctx = ctxRef.current;
      if (playing && ctx) {
        const column = (ctx.currentTime - startedAtRef.current) / secondsPer(previous);
        guitarRef.current?.stopAll();
        startedAtRef.current = ctx.currentTime - column * secondsPer(value);

        const from = parsed.notes.findIndex((n) => n.column > column);
        nextNoteRef.current = from === -1 ? parsed.notes.length : from;
      }

      bpmRef.current = value;
      setBpm(value);
    },
    [playing, parsed.notes],
  );

  useEffect(() => {
    return () => {
      guitarRef.current?.stopAll();
      void ctxRef.current?.close();
    };
  }, []);

  return {
    parsed,
    playable: parsed.notes.length > 0,
    playing,
    bpm,
    column,
    toggle,
    stop,
    setBpm: changeBpm,
  };
}
