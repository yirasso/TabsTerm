// Poisons this module for client bundles: importing it from a component now
// fails at build time with a message that names the cause, instead of dragging
// `env` — and one day a database client — into the browser.
import "server-only";
import { env } from "@/lib/env";
import type { SearchResponse, SongSummary, Tab, TabProvider } from "@/lib/tabs/contract";
import { localProvider } from "./providers/local";

const ALL: Record<string, TabProvider> = {
  [localProvider.id]: localProvider,
};

/** Enabled providers, in the order configured by TAB_PROVIDERS. */
export function activeProviders(): TabProvider[] {
  return env.TAB_PROVIDERS.map((id) => ALL[id]).filter((p): p is TabProvider => Boolean(p));
}

export function getProvider(id: string): TabProvider | null {
  return ALL[id] ?? null;
}

function dedupe(results: SongSummary[]): SongSummary[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.artist.toLowerCase()}|${r.title.toLowerCase()}|${r.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type SearchOptions = {
  /** Restrict to one source. Ignored if that source is not enabled. */
  provider?: string | null;
  signal?: AbortSignal;
};

/**
 * `options.provider` can only narrow `TAB_PROVIDERS`, never widen it: a client
 * must not be able to switch on a source the operator turned off.
 */
function scoped(options: SearchOptions): TabProvider[] {
  const enabled = activeProviders();
  return options.provider ? enabled.filter((p) => p.id === options.provider) : enabled;
}

/**
 * Ask several providers the same question at once. One slow or broken source
 * degrades the response instead of failing it — the UI can then say which
 * source is down rather than showing an empty page.
 */
async function fanOut(
  providers: TabProvider[],
  ask: (provider: TabProvider) => Promise<SongSummary[]>,
): Promise<Pick<SearchResponse, "results" | "degraded">> {
  const settled = await Promise.allSettled(providers.map(ask));

  const results: SongSummary[] = [];
  const degraded: SearchResponse["degraded"] = [];

  settled.forEach((outcome, i) => {
    const provider = providers[i];
    if (!provider) return;
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      degraded.push({
        provider: provider.id,
        reason: outcome.reason instanceof Error ? outcome.reason.message : "unknown error",
      });
    }
  });

  return { results: dedupe(results), degraded };
}

export async function searchAllProviders(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const found = await fanOut(scoped(options), (p) => p.search(query, options.signal));
  return { query, ...found };
}

/**
 * Everything the enumerable sources hold. A search-only upstream is left out
 * entirely rather than counted as a source that answered with nothing — the
 * same distinction `randomTab` makes.
 */
export async function listAllProviders(options: SearchOptions = {}): Promise<SearchResponse> {
  const capable = scoped(options).filter((p) => typeof p.list === "function");
  const found = await fanOut(capable, (p) => p.list?.(options.signal) ?? Promise.resolve([]));
  return { query: "", ...found };
}

export async function getTab(
  providerId: string,
  id: string,
  signal?: AbortSignal,
): Promise<Tab | null> {
  const provider = getProvider(providerId);
  if (!provider) return null;
  return provider.getTab(id, signal);
}

/**
 * A tab drawn from the sources that can enumerate themselves. Returns null when
 * no such source is enabled — a real state, not an error: a source that can only
 * be searched has nothing to draw from.
 *
 * The provider is picked uniformly rather than weighted by catalog size, so
 * with several enumerable sources this favours the smaller ones. Worth
 * revisiting only once there is more than one.
 */
export async function randomTab(options: SearchOptions = {}): Promise<Tab | null> {
  const capable = scoped(options).filter((p) => typeof p.random === "function");

  const provider = capable[Math.floor(Math.random() * capable.length)];
  if (!provider?.random) return null;
  return provider.random(options.signal);
}
