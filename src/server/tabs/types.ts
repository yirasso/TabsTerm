import { z } from "zod";

export const tabTypeSchema = z.enum(["tab", "chords", "bass", "drums", "ukulele", "pro"]);
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
  /** Canonical page on the source, for attribution. */
  sourceUrl: z.string().url().nullable().default(null),
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
});
export type Tab = z.infer<typeof tabSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(songSummarySchema),
  /** Providers that failed, so the UI can say "songsterr is down" instead of "no results". */
  degraded: z.array(z.object({ provider: z.string(), reason: z.string() })),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/**
 * A tab source. Add a file under `providers/`, register it, and both the API
 * and the UI pick it up without further changes.
 */
export interface TabProvider {
  readonly id: string;
  readonly label: string;
  /** Shown in the UI when results must link back to the source. */
  readonly attribution?: string;
  search(query: string, signal?: AbortSignal): Promise<SongSummary[]>;
  getTab(id: string, signal?: AbortSignal): Promise<Tab | null>;
}

/** Stable cross-provider key: `songsterr:1234`. Used in URLs. */
export function songKey(song: Pick<SongSummary, "provider" | "id">) {
  return `${song.provider}:${song.id}`;
}
