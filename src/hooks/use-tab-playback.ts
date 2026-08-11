"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGuitar, type Guitar } from "@/lib/tab/guitar";
import { type ParsedTab, parseTabNotes } from "@/lib/tab/parse-notes";

/**
 * Characters per beat. Positions are two characters wide, so this is four
 * positions — a sixteenth note each at the shown bpm.
 */
const COLUMNS_PER_BEAT = 8;
/** Schedule this far ahead of the clock, so audio never starves. */
const LOOKAHEAD_SECONDS = 0.4;
const TICK_MS = 50;

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

export function useTabPlayback(content: string | null, tuning: string[] | null): PlaybackState {
  const [parsed, setParsed] = useState<ParsedTab>(() => parseTabNotes(content, tuning));
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
    setParsed(parseTabNotes(content, tuning));
  }, [content, tuning]);

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

    const secondsPerColumn = 60 / (bpmRef.current * COLUMNS_PER_BEAT);
    const notes = parsed.notes;

    const timer = setInterval(() => {
      const now = ctx.currentTime;
      const horizon = now + LOOKAHEAD_SECONDS;

      while (nextNoteRef.current < notes.length) {
        const note = notes[nextNoteRef.current];
        if (!note) break;
        const at = startedAtRef.current + note.column * secondsPerColumn;
        if (at > horizon) break;
        guitar.pluck(note.midi, at);
        nextNoteRef.current++;
      }

      const elapsed = now - startedAtRef.current;
      const at = Math.floor(elapsed / secondsPerColumn);
      setColumn(at);

      if (at > parsed.totalColumns && nextNoteRef.current >= notes.length) stop();
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [playing, parsed, stop]);

  // Restarting the scheduler on a tempo change keeps the maths honest: the
  // cursor and the notes are both derived from the same secondsPerColumn.
  const changeBpm = useCallback(
    (next: number | ((prev: number) => number)) => {
      setBpm((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        return Math.min(220, Math.max(40, value));
      });
      if (playing) {
        guitarRef.current?.stopAll();
        const ctx = ctxRef.current;
        if (ctx) {
          startedAtRef.current = ctx.currentTime + 0.05;
          nextNoteRef.current = 0;
        }
      }
    },
    [playing],
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
