import { z } from "zod";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import type { SongSummary, Tab, TabProvider } from "../types";

const BASE = "https://www.songsterr.com";
const SEARCH_SIZE = 25;

/**
 * Songsterr's public JSON API. Undocumented but unauthenticated and stable.
 * It exposes metadata only — the tablature itself lives in their player — so
 * results are marked `externalOnly` rather than inventing content.
 */
const trackSchema = z.object({
  instrument: z.string().optional(),
  /** MIDI note numbers, ordered high string first. */
  tuning: z.array(z.number()).optional(),
  difficulty: z.number().optional(),
  views: z.number().optional(),
});

const songSchema = z.object({
  songId: z.number(),
  artist: z.string(),
  title: z.string(),
  hasChords: z.boolean().optional(),
  isJunk: z.boolean().optional(),
  tracks: z.array(trackSchema).optional(),
});

type SongsterrSong = z.infer<typeof songSchema>;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** MIDI note number to pitch class, e.g. 40 -> "E". */
function midiToNote(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12] ?? "?";
}

/** Songsterr lists strings high-to-low; guitarists read them low-to-high. */
function toTuning(song: SongsterrSong): string[] | null {
  const raw = song.tracks?.find((t) => t.tuning?.length)?.tuning;
  if (!raw?.length) return null;
  return [...raw].reverse().map(midiToNote);
}

function toDifficulty(song: SongsterrSong): Tab["difficulty"] {
  const level = song.tracks?.find((t) => typeof t.difficulty === "number")?.difficulty;
  if (level === undefined) return null;
  if (level <= 1) return "beginner";
  if (level === 2) return "intermediate";
  return "advanced";
}

function toSummary(song: SongsterrSong): SongSummary {
  return {
    id: String(song.songId),
    provider: "songsterr",
    title: song.title,
    artist: song.artist,
    album: null,
    type: song.hasChords ? "chords" : "pro",
    rating: null,
    votes: null,
    // This form redirects to the canonical slug URL, so it survives renames.
    sourceUrl: `${BASE}/a/wa/song?id=${song.songId}`,
  };
}

export const songsterrProvider: TabProvider = {
  id: "songsterr",
  label: "Songsterr",
  attribution: "Tabs hosted by Songsterr",

  async search(query: string, signal?: AbortSignal): Promise<SongSummary[]> {
    const url = `${BASE}/api/songs?pattern=${encodeURIComponent(query)}&size=${SEARCH_SIZE}`;
    const raw = await fetchJson<unknown>(url, {
      signal,
      timeoutMs: env.TAB_FETCH_TIMEOUT_MS,
      next: { revalidate: 3600, tags: ["songsterr-search"] },
    });

    const parsed = z.array(songSchema).safeParse(raw);
    if (!parsed.success) return [];

    return parsed.data.filter((song) => !song.isJunk).map(toSummary);
  },

  async getTab(id: string, signal?: AbortSignal): Promise<Tab | null> {
    if (!/^\d+$/.test(id)) return null;

    const raw = await fetchJson<unknown>(`${BASE}/api/song/${id}`, {
      signal,
      timeoutMs: env.TAB_FETCH_TIMEOUT_MS,
      next: { revalidate: 86400 },
    }).catch(() => null);

    const parsed = songSchema.safeParse(raw);
    if (!parsed.success) return null;

    return {
      ...toSummary(parsed.data),
      content: null,
      tuning: toTuning(parsed.data),
      capo: null,
      difficulty: toDifficulty(parsed.data),
      externalOnly: true,
    };
  },
};
