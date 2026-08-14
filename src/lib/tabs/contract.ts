/**
 * The tab contract: the shapes and rules both sides of the wire agree on.
 *
 * This lives in `lib/` rather than `server/` because the client genuinely needs
 * it as *values*, not just types — `use-song-search` parses responses through
 * `searchResponseSchema`, the drafts store calls `deriveCapability`, and the
 * badge reads the label maps. It used to sit in `src/server/tabs/types.ts`,
 * which meant four client modules were importing from a server folder and
 * getting away with it only because nothing in that file reached for the
 * server. The day it did — a database client, a secret, `node:fs` — the build
 * would have broken somewhere that gave no hint why.
 *
 * So the rule is the file's location, not a comment: everything here must be
 * safe to run in a browser. It imports zod and one pure parser and nothing else.
 * Server-side machinery (the provider registry, the providers themselves) is
 * marked `server-only` and imports this, never the other way around.
 */

import { z } from "zod";
import { isPlayable } from "@/lib/tab/parse-notes";

/**
 * Guitar tablature and nothing else, for now. Kept as an enum rather than
 * dropped so bass or ukulele can come back as one added member, instead of
 * having to re-thread a field through the schema, the editor and the UI.
 *
 * With a single member it says nothing, so it is not displayed anywhere.
 */
export const tabTypeSchema = z.enum(["tab"]);
export type TabType = z.infer<typeof tabTypeSchema>;

/**
 * What a result actually gives the reader, so the UI can say so up front:
 *
 * - `full` — has a stave we can turn into notes, so it plays back.
 * - `text` — readable, but nothing we can play (a chord sheet, say).
 * - `link` — reserved: reading it would mean leaving for another site. Nothing
 *   emits this today, since every source is one we host.
 *
 * This is a promise to the user, not a description of the source, which is why
 * it rides on the summary rather than being derived in a component.
 */
export const tabCapabilitySchema = z.enum(["full", "text", "link"]);
export type TabCapability = z.infer<typeof tabCapabilitySchema>;

/** What a search result row carries. Cheap to fetch, safe to list. */
export const songSummarySchema = z.object({
  /** Provider-local id. Unique only within `provider`. */
  id: z.string().min(1),
  provider: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().nullable().default(null),
  type: tabTypeSchema.default("tab"),
  /** 0–5, when the source exposes one. */
  rating: z.number().min(0).max(5).nullable().default(null),
  votes: z.number().int().nonnegative().nullable().default(null),
  /** Canonical page on the source, for attribution. */
  sourceUrl: z.string().url().nullable().default(null),
  capability: tabCapabilitySchema.default("link"),
});
export type SongSummary = z.infer<typeof songSummarySchema>;

/** A full tab. `content` is plain-text ASCII tablature, monospace-ready. */
export const tabSchema = songSummarySchema.extend({
  content: z.string().nullable().default(null),
  tuning: z.array(z.string()).nullable().default(null),
  capo: z.number().int().min(0).max(12).nullable().default(null),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullable().default(null),
  /** Set when the source can only be viewed off-site (embed/player-only tabs). */
  externalOnly: z.boolean().default(false),
  /** SPDX-ish licence string, required for anything imported from a corpus. */
  license: z.string().nullable().default(null),
  /** Who to credit — a contributor's handle, or a corpus's required attribution. */
  attributionName: z.string().nullable().default(null),
});
export type Tab = z.infer<typeof tabSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(songSummarySchema),
  /** Providers that failed, so the UI can say which source is down rather than "no results". */
  degraded: z.array(z.object({ provider: z.string(), reason: z.string() })),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/**
 * A tab source. Add a file under `server/tabs/providers/`, register it, and both
 * the API and the UI pick it up without further changes.
 *
 * The interface is declared here rather than beside the registry because it is
 * part of the contract: it is the shape of what comes back over the wire.
 * Implementations are server-side; this declaration is not.
 */
export interface TabProvider {
  readonly id: string;
  readonly label: string;
  /** Shown in the UI when results must link back to the source. */
  readonly attribution?: string;
  search(query: string, signal?: AbortSignal): Promise<SongSummary[]>;
  getTab(id: string, signal?: AbortSignal): Promise<Tab | null>;
  /**
   * Optional, and the same capability as `random` below: only a source that can
   * enumerate its own catalog can hand back all of it. A search-only upstream
   * omits both, and `/list` leaves it out rather than pretending it returned
   * nothing.
   */
  list?(signal?: AbortSignal): Promise<SongSummary[]>;
  /**
   * Optional. Only sources that can enumerate their own catalog can offer a
   * random pick — a search-only upstream simply omits this, and `/rand` skips
   * it rather than guessing an id.
   */
  random?(signal?: AbortSignal): Promise<Tab | null>;
}

/** Stable cross-provider key: `local:greensleeves`. Used in URLs. */
export function songKey(song: Pick<SongSummary, "provider" | "id">) {
  return `${song.provider}:${song.id}`;
}

/**
 * The single place capability is decided. Providers call this rather than
 * hard-coding a value.
 *
 * `full` means we found a stave we can turn into notes — which is exactly the
 * condition the player needs, so the badge can never promise sound the player
 * cannot deliver.
 */
export function deriveCapability(
  tab: Pick<Tab, "content" | "externalOnly"> & { tuning?: string[] | null },
): TabCapability {
  if (tab.externalOnly) return "link";
  if (!tab.content) return "link";
  return isPlayable(tab.content, tab.tuning ?? null) ? "full" : "text";
}

/** Short label for the badge, in the terminal's lowercase register. */
export const CAPABILITY_LABEL: Record<TabCapability, string> = {
  full: "audio",
  text: "text",
  link: "link",
};

/** Sentence shown on the tab page, where there is room to be explicit. */
export const CAPABILITY_DETAIL: Record<TabCapability, string> = {
  full: "tab + audio",
  text: "tab, no audio",
  link: "opens on source",
};
