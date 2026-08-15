"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandLine } from "@/components/chrome/command-line";
import { TabGrid } from "@/components/editor/tab-grid";
import { TranscribeControls } from "@/components/editor/transcribe-controls";
import { PlaybackBar } from "@/components/tab/playback-bar";
import { useTabPlayback } from "@/hooks/use-tab-playback";
import { appendBlock, blankStave, validateTab } from "@/lib/tab/edit";
import { type Draft, useDrafts } from "@/stores/drafts";

const TUNINGS: Record<string, string[]> = {
  standard: ["E", "A", "D", "G", "B", "E"],
  "drop d": ["D", "A", "D", "G", "B", "E"],
  dadgad: ["D", "A", "D", "G", "A", "D"],
  "half step down": ["D#", "G#", "C#", "F#", "A#", "D#"],
  "open g": ["D", "G", "D", "G", "B", "D"],
};

function tuningName(tuning: string[] | null) {
  const match = Object.entries(TUNINGS).find(
    ([, value]) => tuning && value.join() === tuning.join(),
  );
  return match?.[0] ?? "standard";
}

export function TabEditor({ draft: initial }: { draft: Draft }) {
  const router = useRouter();
  const upsert = useDrafts((s) => s.upsert);
  const remove = useDrafts((s) => s.remove);

  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState(false);

  // The same parse drives the preview and the sound, so a cursor can never sit
  // on a note the player is not about to play.
  const { parsed, playable, playing, bpm, column, toggle, stop, setBpm } = useTabPlayback(
    draft.content,
    draft.tuning,
    draft.capo ?? 0,
  );
  const activeStaveRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => validateTab(draft.content), [draft.content]);

  // Follow the cursor by scrolling to whichever stave holds it. Not optional:
  // a cursor you cannot see is not a cursor.
  useEffect(() => {
    if (!playing) return;
    const el = activeStaveRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [playing]);

  const patch = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setSaved(false);
  };

  // Autosave, so a closed tab never costs someone their work.
  useEffect(() => {
    if (!draft.title && !draft.content) return;
    const timer = setTimeout(() => {
      upsert(draft);
      setSaved(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, upsert]);

  /** Add a stave at the end, which is where a tab grows. */
  const append = (text: string) => {
    patch({ content: appendBlock(draft.content, text) });
  };

  const strings = draft.tuning?.length === 4 ? 4 : 6;
  const canSave = draft.title.trim().length > 0 && parsed.blocks.length > 0;

  // Leaving the page has to silence the guitar; the audio graph outlives the
  // component that started it.
  const leave = (to: Route) => {
    stop();
    router.push(to);
  };

  /**
   * Nothing is published any more, so this is a save that also stops editing.
   * `published` survives as the flag that decides whether a tab shows up in
   * search — collapsing it into "there is only one kind of tab" is Etapa 3.
   */
  const save = () => {
    const next = { ...draft, published: true };
    upsert(next);
    setDraft(next);
    leave(`/draft/${draft.id}` as Route);
  };

  return (
    <>
      <main className="mx-auto max-w-[980px] px-[22px] pb-[140px] pt-7">
        <CommandLine>tab --new</CommandLine>
        <p className="mt-1 mb-7 text-[11px] text-term-faint">
          tabs live in this browser until there is an account to keep them in.
          {saved ? " saved." : ""}
        </p>

        {/* The title and artist name the thing being made, so they sit above
            the settings rather than beside them at the same weight — six
            identical fields is a form, not a piece of work with a name. */}
        {/* Both placeholders name their field rather than proposing a value.
            Neither input carries a separate label: the word sitting in the empty
            field is the label, and it leaves as soon as there is a real title to
            read in its place. */}
        <div className="mb-5 border-term-fg border-b-2 pb-3">
          <input
            id="tab-title"
            aria-label="title"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="title"
            className="tt-display w-full border-0 bg-transparent p-0 caret-term-accent outline-none placeholder:text-term-faint"
          />
          <input
            id="tab-artist"
            aria-label="artist"
            value={draft.artist}
            onChange={(e) => patch({ artist: e.target.value })}
            placeholder="artist"
            className="mt-1 w-full border-0 bg-transparent p-0 text-[15px] text-term-dim caret-term-accent outline-none placeholder:text-term-faint"
          />
        </div>

        {/* One row: three short settings that read as a single sentence about
            how the tab is played. Each sizes to what it holds rather than to a
            column, and they wrap only when the window is too narrow to hold
            them. */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-term-line border-b pb-5">
          <Field label="tuning" htmlFor="tab-tuning" className="w-[220px] flex-none">
            <select
              id="tab-tuning"
              value={tuningName(draft.tuning)}
              onChange={(e) => patch({ tuning: TUNINGS[e.target.value] ?? null })}
              className="w-full border-0 bg-transparent text-[13px] outline-none"
            >
              {Object.keys(TUNINGS).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="capo" htmlFor="tab-capo" className="w-[130px] flex-none">
            <input
              id="tab-capo"
              type="number"
              min={0}
              max={12}
              value={draft.capo ?? 0}
              onChange={(e) => patch({ capo: Number(e.target.value) })}
              className="w-full border-0 bg-transparent text-[13px] caret-term-accent outline-none"
            />
          </Field>
          <TranscribeControls
            className="min-w-[260px] flex-1"
            tuning={draft.tuning}
            onResult={(result, name) => {
              // Append rather than replace: a second take belongs after the
              // first, and nobody should lose what they already wrote by
              // reaching for the microphone.
              patch({
                content: appendBlock(draft.content, result.content),
                capo: result.capo,
                ...(draft.title.trim() || !name ? {} : { title: name }),
              });
            }}
          />
        </div>

        <div className="mt-5 mb-2 flex flex-wrap items-center gap-3 text-[11px]">
          <Action onClick={() => append(blankStave(draft.tuning, strings))}>+ stave</Action>
        </div>

        {/* The stave is the work. It gets the room and the frame; everything
            above it is the paperwork that describes it. */}
        <section
          className="w-fit max-w-full border border-term-fg bg-term-panel px-4 py-[18px]"
          aria-label="tablature"
        >
          {parsed.blocks.length > 0 ? (
            <>
              <div className="mb-4 text-[11px] text-term-faint">
                click a position, then type a fret · arrows move · backspace clears
              </div>
              <TabGrid
                content={draft.content}
                blocks={parsed.blocks}
                column={playing ? column : -1}
                activeRef={activeStaveRef}
                onChange={(content) => patch({ content })}
              />
            </>
          ) : (
            <p className="text-[12px] text-term-faint">
              nothing here yet — add a stave to start, or record what you are playing.
            </p>
          )}
        </section>

        <div aria-live="polite" className="mt-2 min-h-[20px] text-[11px]">
          {issues.length === 0 ? (
            <span className="text-term-faint">grid is square.</span>
          ) : (
            issues.map((issue) => (
              <div key={`${issue.line}-${issue.message}`} className="text-term-accent">
                line {issue.line}: {issue.message}
              </div>
            ))
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-[12px]">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="border border-term-fg px-3 py-[7px] enabled:hover:border-term-accent enabled:hover:text-term-accent disabled:cursor-not-allowed disabled:border-term-line disabled:text-term-faint"
          >
            save
          </button>
          {!canSave && (
            <span className="text-[11px] text-term-faint">needs a title and something to show</span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              remove(draft.id);
              leave("/" as Route);
            }}
            className="text-[11px] text-term-faint hover:text-term-accent"
          >
            discard
          </button>
        </div>
      </main>

      <PlaybackBar
        playable={playable}
        playing={playing}
        bpm={bpm}
        column={column}
        parsed={parsed}
        toggle={toggle}
        setBpm={setBpm}
      >
        <span className="flex-1" />
        <span className="text-[11px] text-term-faint">
          {parsed.notes.length} notes · {parsed.totalColumns} columns
        </span>
      </PlaybackBar>
    </>
  );
}

function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  /** How much of the settings row this field takes. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-baseline gap-[9px] border-term-line border-b pb-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="flex-none text-[11px] text-term-faint">
        {label}
      </label>
      {children}
    </div>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap border border-term-line px-2 py-[3px] text-term-dim hover:border-term-accent hover:text-term-fg"
    >
      {children}
    </button>
  );
}
