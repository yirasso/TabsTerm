"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SongSummary, Tab, TabType } from "@/server/tabs/types";
import { deriveCapability } from "@/server/tabs/types";

/**
 * Tabs written in the browser, before there is a database to put them in.
 *
 * Persisted to localStorage so a draft survives a reload — losing a tab someone
 * spent twenty minutes typing would be unforgivable. When Supabase lands these
 * migrate into it and this store becomes a staging area for unsaved work.
 */
export type Draft = {
  id: string;
  title: string;
  artist: string;
  type: TabType;
  tuning: string[] | null;
  capo: number | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  content: string;
  /** Set once the writer says it is ready; drafts stay out of search. */
  published: boolean;
  updatedAt: number;
};

export const DRAFT_PROVIDER = "draft";

export function emptyDraft(id: string): Draft {
  return {
    id,
    title: "",
    artist: "",
    type: "tab",
    tuning: ["E", "A", "D", "G", "B", "E"],
    capo: 0,
    difficulty: null,
    content: "",
    published: false,
    updatedAt: 0,
  };
}

/** Shape a draft like anything else the app renders, so views can be reused. */
export function draftToTab(draft: Draft): Tab {
  return {
    id: draft.id,
    provider: DRAFT_PROVIDER,
    title: draft.title || "untitled",
    artist: draft.artist || "unknown",
    album: null,
    type: draft.type,
    rating: null,
    votes: null,
    sourceUrl: null,
    capability: deriveCapability({
      content: draft.content,
      externalOnly: false,
      tuning: draft.tuning,
    }),
    content: draft.content,
    tuning: draft.tuning,
    capo: draft.capo,
    difficulty: draft.difficulty,
    externalOnly: false,
    license: null,
    attributionName: null,
  };
}

export function draftToSummary(draft: Draft): SongSummary {
  const { content: _content, tuning: _tuning, ...summary } = draftToTab(draft);
  return summary;
}

type DraftsState = {
  drafts: Record<string, Draft>;
  upsert: (draft: Draft) => void;
  remove: (id: string) => void;
  get: (id: string) => Draft | null;
  list: () => Draft[];
};

export const useDrafts = create<DraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},
      upsert: (draft) =>
        set((s) => ({
          drafts: { ...s.drafts, [draft.id]: { ...draft, updatedAt: Date.now() } },
        })),
      remove: (id) =>
        set((s) => {
          const { [id]: _gone, ...rest } = s.drafts;
          return { drafts: rest };
        }),
      get: (id) => get().drafts[id] ?? null,
      list: () => Object.values(get().drafts).sort((a, b) => b.updatedAt - a.updatedAt),
    }),
    { name: "tabsterm-drafts", version: 1 },
  ),
);

/** Ids are visible in URLs, so keep them short and unambiguous. */
export function newDraftId() {
  return Math.random().toString(36).slice(2, 10);
}
