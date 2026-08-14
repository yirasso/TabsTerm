"use client";

import { useRef, useState } from "react";
import { decodeBlob, decodeFile, type MonoAudio } from "@/lib/audio/decode";
import { NothingHeard, type Transcription, transcribeAudio } from "@/lib/audio/transcribe";

type Phase = "idle" | "recording" | "working" | "failed";

/**
 * Record or choose a recording, and get tablature back into the draft you are
 * already editing.
 *
 * This sits with the other fields rather than on a page of its own, because
 * transcribing is a way of starting a tab, not a separate thing to do: what
 * comes out is a first pass that needs the same title, tuning and corrections
 * as anything typed by hand.
 */
export function TranscribeControls({
  tuning,
  className = "",
  onResult,
}: {
  tuning: string[] | null;
  /** How much of the settings row this takes. */
  className?: string;
  onResult: (result: Transcription, name: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [percent, setPercent] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const run = async (load: () => Promise<MonoAudio>, name: string | null) => {
    setPhase("working");
    setPercent(0);
    setStatus("decoding…");
    try {
      const result = await transcribeAudio(await load(), tuning, {
        onStage: setStatus,
        onPercent: setPercent,
      });
      setPhase("idle");
      setStatus("");
      onResult(result, name);
    } catch (error) {
      setPhase("failed");
      setStatus(
        error instanceof NothingHeard || error instanceof Error ? error.message : "analysis failed",
      );
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        void run(() => decodeBlob(blob), null);
      };

      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
      setStatus("recording — play something, then stop");
    } catch {
      setPhase("failed");
      setStatus("no microphone available, or permission refused");
    }
  };

  const busy = phase === "working";

  return (
    // The rule sits under the controls, not under the status line, so it lines
    // up with the rule under tuning and capo beside it.
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-[9px] border-term-line border-b pb-1.5">
        <span className="flex-none text-[11px] text-term-faint">audio</span>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {phase === "recording" ? (
            <button
              type="button"
              onClick={() => {
                recorderRef.current?.stop();
                recorderRef.current = null;
              }}
              className="whitespace-nowrap border border-term-accent px-2 py-[3px] text-term-accent"
            >
              ■ stop
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startRecording()}
              className="whitespace-nowrap border border-term-line px-2 py-[3px] text-term-dim hover:border-term-accent hover:text-term-fg disabled:cursor-not-allowed disabled:text-term-faint"
            >
              ● record
            </button>
          )}
          {/* Someone who already recorded their playing should not have to play
              it again into a microphone. */}
          <label
            htmlFor="audio-file"
            className={`whitespace-nowrap border border-term-line px-2 py-[3px] text-term-dim ${
              busy
                ? "cursor-not-allowed text-term-faint"
                : "cursor-pointer hover:border-term-accent hover:text-term-fg"
            }`}
          >
            ↑ upload
          </label>
          <input
            id="audio-file"
            type="file"
            accept="audio/*"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void run(() => decodeFile(file), file.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </div>
      </div>

      <div aria-live="polite" className="min-h-[13px] text-[10px]">
        {busy && (
          <span className="text-term-dim">
            {status} {percent > 0 ? `${percent}%` : ""}
          </span>
        )}
        {phase === "recording" && <span className="text-term-accent">{status}</span>}
        {phase === "failed" && <span className="text-term-accent">err: {status}</span>}
        {phase === "idle" && !status && (
          <span className="text-term-faint">one guitar, alone. it never leaves this browser.</span>
        )}
      </div>
    </div>
  );
}
