"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TabRender } from "@/components/tab/tab-render";
import { alignStaves, blankStave, insertAt, validateTab } from "@/lib/tab/edit";
import { parseTabNotes } from "@/lib/tab/parse-notes";
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
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = useState(false);

  const parsed = useMemo(
    () => parseTabNotes(draft.content, draft.tuning),
    [draft.content, draft.tuning],
  );
  const issues = useMemo(() => validateTab(draft.content), [draft.content]);

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

  const insert = (text: string) => {
    const area = areaRef.current;
    const at = area?.selectionStart ?? draft.content.length;
    const { value, caret } = insertAt(draft.content, at, text);
    patch({ content: value });
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(caret, caret);
    });
  };

  const strings = draft.tuning?.length === 4 ? 4 : 6;
  const canPublish = draft.title.trim().length > 0 && parsed.blocks.length > 0;

  const publish = () => {
    const next = { ...draft, published: true };
    upsert(next);
    setDraft(next);
    router.push(`/draft/${draft.id}` as Route);
  };

  return (
    <main className="mx-auto max-w-[980px] px-[22px] pb-24 pt-7">
      <div className="mb-1 text-term-dim">
        <span className="text-term-accent">$</span> tab --new
      </div>
      <p className="mb-6 text-[11px] text-term-faint">
        drafts live in this browser until there is somewhere to publish them.
        {saved ? " saved." : ""}
      </p>

      <div className="grid gap-x-6 gap-y-3 border-term-line border-b pb-5 sm:grid-cols-2">
        <Field label="title" htmlFor="tab-title">
          <input
            id="tab-title"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Greensleeves"
            className="w-full border-0 bg-transparent text-[13px] caret-term-accent outline-none"
          />
        </Field>
        <Field label="artist" htmlFor="tab-artist">
          <input
            id="tab-artist"
            value={draft.artist}
            onChange={(e) => patch({ artist: e.target.value })}
            placeholder="Traditional"
            className="w-full border-0 bg-transparent text-[13px] caret-term-accent outline-none"
          />
        </Field>
        <Field label="tuning" htmlFor="tab-tuning">
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
        <Field label="capo" htmlFor="tab-capo">
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
        <Field label="level" htmlFor="tab-level">
          <select
            id="tab-level"
            value={draft.difficulty ?? ""}
            onChange={(e) => patch({ difficulty: (e.target.value || null) as Draft["difficulty"] })}
            className="w-full border-0 bg-transparent text-[13px] outline-none"
          >
            <option value="">—</option>
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </Field>
      </div>

      <div className="mt-5 mb-2 flex flex-wrap items-center gap-3 text-[11px]">
        <Action onClick={() => insert(blankStave(draft.tuning, strings))}>+ stave</Action>
        <Action onClick={() => insert("[section]")}>+ section</Action>
        <Action onClick={() => patch({ content: alignStaves(draft.content) })}>align grid</Action>
        <span className="flex-1" />
        <span className="text-term-faint">
          {parsed.notes.length} notes · {parsed.totalColumns} columns
        </span>
      </div>

      <textarea
        ref={areaRef}
        value={draft.content}
        onChange={(e) => patch({ content: e.target.value })}
        spellCheck={false}
        aria-label="tablature"
        placeholder={"[intro]\ne|--0--2--|\nB|--------|"}
        className="tab-content h-[45vh] w-full resize-y border border-term-line bg-term-panel p-3 text-[13px] leading-[1.8] caret-term-accent outline-none focus:border-term-accent"
      />

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

      {parsed.blocks.length > 0 && (
        <section className="mt-8 border-term-line border-t pt-5">
          <div className="mb-4 text-[11px] text-term-faint">preview</div>
          <TabRender blocks={parsed.blocks} column={-1} />
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3 text-[12px]">
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="border border-term-fg px-3 py-[7px] enabled:hover:border-term-accent enabled:hover:text-term-accent disabled:cursor-not-allowed disabled:border-term-line disabled:text-term-faint"
        >
          publish →
        </button>
        {!canPublish && (
          <span className="text-[11px] text-term-faint">needs a title and something to show</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            remove(draft.id);
            router.push("/");
          }}
          className="text-[11px] text-term-faint hover:text-term-accent"
        >
          discard
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-[9px] border-term-line border-b pb-1.5">
      <label htmlFor={htmlFor} className="w-16 flex-none text-[11px] text-term-faint">
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
