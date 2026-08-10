import { z } from "zod";

export const tabTypeSchema = z.enum(["tab", "chords", "bass", "drums", "ukulele", "pro"]);
export type TabType = z.infer<typeof tabTypeSchema>;

/**
 * What a result actually gives the reader, so the UI can say so up front:
 *
 * - `full` — tablature we can render, with audio and a moving cursor.
 * - `text` — tablature we can render, silent.
 * - `link` — we know the song exists; reading it means leaving for the source.
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
  /**
   * Optional. Only sources that can enumerate their own catalog can offer a
   * random pick — a search-only upstream like Songsterr simply omits this, and
   * `/random` skips it rather than guessing an id.
   */
  random?(signal?: AbortSignal): Promise<Tab | null>;
}

/** Stable cross-provider key: `songsterr:1234`. Used in URLs. */
export function songKey(song: Pick<SongSummary, "provider" | "id">) {
  return `${song.provider}:${song.id}`;
}

/**
 * The single place capability is decided. Providers call this rather than
 * hard-coding a value, so when audio arrives only this function changes.
 */
export function deriveCapability(tab: Pick<Tab, "content" | "externalOnly">): TabCapability {
  if (tab.externalOnly || !tab.content) return "link";
  // Becomes "full" for tabs that also carry generated audio.
  return "text";
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
