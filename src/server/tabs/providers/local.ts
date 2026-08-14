// A provider answers over the wire, never from the browser. See registry.ts.
import "server-only";
import { seedTabs } from "@/data/seed-tabs";
import {
  type SongSummary,
  songSummarySchema,
  type Tab,
  type TabProvider,
  tabSchema,
} from "@/lib/tabs/contract";
import { slugify } from "@/lib/utils";

const tabs: Tab[] = seedTabs.map((t) => tabSchema.parse({ ...t, provider: "local" }));

function score(tab: Tab, query: string) {
  const q = slugify(query);
  if (!q) return 0;
  const haystack = slugify(`${tab.title} ${tab.artist} ${tab.album ?? ""}`);
  if (haystack === q) return 100;
  if (slugify(tab.title) === q) return 90;
  if (haystack.startsWith(q)) return 70;
  if (haystack.includes(q)) return 50;
  // Fall back to token overlap so "nirvana teen" still finds the song.
  const tokens = q.split("-").filter(Boolean);
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  return tokens.length > 0 ? Math.round((hits / tokens.length) * 40) : 0;
}

/**
 * In-repo tablature. Always available, needs no network, and is what the app
 * renders during development and tests.
 */
export const localProvider: TabProvider = {
  id: "local",
  label: "Local library",

  async search(query: string): Promise<SongSummary[]> {
    return (
      tabs
        .map((tab) => ({ tab, s: score(tab, query) }))
        .filter(({ s }) => s > 0)
        .sort((a, b) => b.s - a.s)
        // Parsing through the summary schema strips `content` — search results
        // stay small and never ship full tablature to the client.
        .map(({ tab }) => songSummarySchema.parse(tab))
    );
  },

  async list(): Promise<SongSummary[]> {
    // Alphabetical, because a list with no query has no relevance to sort by
    // and an arbitrary order reads as a bug.
    return tabs
      .map((tab) => songSummarySchema.parse(tab))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async getTab(id: string): Promise<Tab | null> {
    return tabs.find((t) => t.id === id) ?? null;
  },

  async random(): Promise<Tab | null> {
    if (tabs.length === 0) return null;
    return tabs[Math.floor(Math.random() * tabs.length)] ?? null;
  },
};
