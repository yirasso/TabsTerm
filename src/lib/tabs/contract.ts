/**
 * The tab contract: the shapes and rules both sides of the wire agree on.
 *
 * This lives in `lib/` rather than `server/` because the client genuinely needs
 * it as *values*, not just types — `use-song-search` parses responses through
 * `searchResponseSchema`, and the drafts store builds a `Tab` from a draft. It
 * used to sit in `src/server/tabs/types.ts`, which meant client modules were
 * importing from a server folder and getting away with it only because nothing
 * in that file reached for the server. The day it did — a database client, a
 * secret, `node:fs` — the build would have broken somewhere that gave no hint
 * why.
 *
 * So the rule is the file's location, not a comment: everything here must be
 * safe to run in a browser. Server-side machinery (the provider registry, the
 * providers themselves) is marked `server-only` and imports this, never the
 * other way around.
 */

import { z } from "zod";

/**
 * Guitar tablature and nothing else, for now. Kept as an enum rather than
 * dropped so bass or ukulele can come back as one added member, instead of
 * having to re-thread a field through the schema, the editor and the UI.
 *
 * With a single member it says nothing, so it is not displayed anywhere.
 */
export const tabTypeSchema = z.enum(["tab"]);
export type TabType = z.infer<typeof tabTypeSchema>;

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
});
export type SongSummary = z.infer<typeof songSummarySchema>;

/** A full tab. `content` is plain-text ASCII tablature, monospace-ready. */
export const tabSchema = songSummarySchema.extend({
  content: z.string().nullable().default(null),
  tuning: z.array(z.string()).nullable().default(null),
  capo: z.number().int().min(0).max(12).nullable().default(null),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullable().default(null),
  /**
   * SPDX-ish licence string. Nothing sets it today; it stays because shipped
   * example tablature is public-domain content the product carries on purpose,
   * and provenance for that is a standing commitment in PRODUCT.md rather than
   * catalogue plumbing.
   */
  license: z.string().nullable().default(null),
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
