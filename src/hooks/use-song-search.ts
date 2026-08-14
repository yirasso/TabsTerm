"use client";

import { useQuery } from "@tanstack/react-query";
import { type SearchResponse, searchResponseSchema } from "@/lib/tabs/contract";

async function fetchJson(url: string, signal: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return searchResponseSchema.parse(await res.json());
}

/**
 * What the results screen shows: either what matched a query, or everything.
 *
 * Which sources are asked is the operator's decision, not the reader's — the API
 * still accepts a `provider` filter, but nothing in the UI sets one.
 *
 * `all` is not "search for an empty string". Searching needs a minimum length so
 * the first keystroke does not fire a request, and listing has no query at all;
 * folding them together would mean either listing the library on every stray `a`
 * or never listing it.
 */
export function useSongSearch(query: string, { all = false }: { all?: boolean } = {}) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: all ? ["tabs"] : ["search", trimmed],
    queryFn: ({ signal }) =>
      all
        ? fetchJson("/api/tabs", signal)
        : fetchJson(`/api/search?${new URLSearchParams({ q: trimmed })}`, signal),
    enabled: all || trimmed.length >= 2,
    placeholderData: (previous) => previous,
  });
}
