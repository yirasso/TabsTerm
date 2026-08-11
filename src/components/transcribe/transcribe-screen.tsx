"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { decodeBlob, decodeFile, type MonoAudio } from "@/lib/audio/decode";
import { assignFrets } from "@/lib/tab/fretting";
import { STANDARD_TUNING } from "@/lib/tab/parse-notes";
import { notesToAscii } from "@/lib/tab/to-ascii";
import { emptyDraft, newDraftId, useDrafts } from "@/stores/drafts";

const TUNING = ["E", "A", "D", "G", "B", "E"];

type Phase = "idle" | "recording" | "working" | "failed";

export function TranscribeScreen() {
  const router = useRouter();
  const upsert = useDrafts((s) => s.upsert);

  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [percent, setPercent] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fail = (message: string) => {
    setPhase("failed");
    setStatus(message);
  };

  /** Everything lands here: build a draft and hand it to the editor to fix up. */
  const transcribe = async (audio: MonoAudio, title: string) => {
    setStatus("working out the notes…");
    const { detectNotes } = await import("@/lib/audio/notes");
    const events = await detectNotes(audio, setPercent);

    if (events.length === 0) return fail("no notes found — try playing louder or closer");

    setStatus("choosing strings and frets…");
    const fretted = assignFrets(events, STANDARD_TUNING);
    if (fretted.length === 0) return fail("nothing that fits on a guitar neck");

    const id = newDraftId();
    upsert({
      ...emptyDraft(id),
      title,
      tuning: TUNING,
      content: `[take 1]\n${notesToAscii(fretted, { tuning: TUNING })}`,
    });
    router.push(`/new?id=${id}` as Route);
  };

  const runFile = async (file: File) => {
    setPhase("working");
    setPercent(0);
    setStatus("decoding…");
    try {
      const audio = await decodeFile(file);
      await transcribe(audio, file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      fail(error instanceof Error ? error.message : "analysis failed");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        setPhase("working");
        setPercent(0);
        setStatus("decoding…");
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          await transcribe(await decodeBlob(blob), "Untitled take");
        } catch (error) {
          fail(error instanceof Error ? error.message : "analysis failed");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
      setStatus("recording — play something, then stop");
    } catch {
      fail("no microphone available, or permission refused");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  return (
    <main className="mx-auto max-w-[820px] px-[22px] pb-24 pt-7">
      <div className="mb-1 text-term-dim">
        <span className="text-term-accent">$</span> listen
      </div>
      <pre className="mb-7 whitespace-pre-wrap text-[12px] text-term-dim">
        {`audio never leaves this browser. it is decoded, analysed and thrown away
on your machine — nothing is uploaded, and there is nothing for us to keep.`}
      </pre>

      <pre className="mb-6 whitespace-pre-wrap text-[12px] text-term-faint leading-[1.8]">
        {`give it one guitar on its own and it will work out the notes and where to
play them. a full band mix will come back as noise — every instrument at once
is more than any note detector can pull apart.

play slowly and cleanly. a pickup beats a phone microphone.`}
      </pre>

      <div className="flex flex-wrap items-center gap-3">
        {phase === "recording" ? (
          <button
            type="button"
            onClick={stopRecording}
            className="border border-term-accent px-3 py-[7px] text-[12px] text-term-accent"
          >
            ■ stop and transcribe
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="border border-term-line px-3 py-[7px] text-[12px] hover:border-term-accent hover:text-term-accent"
          >
            ● record
          </button>
        )}
        <span className="text-[11px] text-term-faint">or</span>
        {/* Someone who already recorded their playing should not have to play
            it again into a microphone. */}
        <label
          htmlFor="audio-file"
          className="cursor-pointer border border-term-line px-3 py-[7px] text-[12px] hover:border-term-accent hover:text-term-accent"
        >
          choose a recording
        </label>
        <input
          id="audio-file"
          type="file"
          accept="audio/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void runFile(file);
          }}
        />
      </div>

      <div aria-live="polite" className="mt-8 min-h-[48px] text-[12px]">
        {phase === "working" && (
          <>
            <div className="text-term-dim">
              {status} {percent > 0 ? `${percent}%` : ""}
            </div>
            <div className="mt-2 h-[2px] w-full bg-term-line">
              <div
                className="h-full bg-term-accent transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        )}
        {phase === "recording" && <div className="text-term-accent">{status}</div>}
        {phase === "failed" && <div className="text-term-accent">err: {status}</div>}
      </div>
    </main>
  );
}
