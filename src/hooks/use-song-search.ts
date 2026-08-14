"use client";

import { useQuery } from "@tanstack/react-query";
import { type SearchResponse, searchResponseSchema } from "@/lib/tabs/contract";

async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });

  const res = await fetch(`/api/search?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return searchResponseSchema.parse(await res.json());
}

/**
 * Debounced, cached song search across every source the server has enabled.
 *
 * Which sources those are is the operator's decision, not the reader's: the API
 * still takes a `provider` filter, but nothing in the UI sets one, so a search
 * here always asks the same question.
 */
export function useSongSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["search", trimmed],
    queryFn: ({ signal }) => fetchSearch(trimmed, signal),
    enabled: trimmed.length >= 2,
    placeholderData: (previous) => previous,
  });
}
