"use client";

import { useQuery } from "@tanstack/react-query";
import { type SearchResponse, searchResponseSchema } from "@/server/tabs/types";
import { usePrefs } from "@/stores/prefs";

async function fetchSearch(
  query: string,
  provider: string | null,
  signal: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (provider) params.set("provider", provider);

  const res = await fetch(`/api/search?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return searchResponseSchema.parse(await res.json());
}

/**
 * Debounced, cached song search. Reads the provider filter from the store
 * itself so every caller — prompt and palette alike — stays in agreement.
 */
export function useSongSearch(query: string) {
  const provider = usePrefs((s) => s.provider);
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["search", trimmed, provider ?? "all"],
    queryFn: ({ signal }) => fetchSearch(trimmed, provider, signal),
    enabled: trimmed.length >= 2,
    placeholderData: (previous) => previous,
  });
}
