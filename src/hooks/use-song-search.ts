"use client";

import { useQuery } from "@tanstack/react-query";
import { type SearchResponse, searchResponseSchema } from "@/server/tabs/types";

async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return searchResponseSchema.parse(await res.json());
}

/** Debounced, cached song search. Disabled until the query is meaningful. */
export function useSongSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["search", trimmed],
    queryFn: ({ signal }) => fetchSearch(trimmed, signal),
    enabled: trimmed.length >= 2,
    placeholderData: (previous) => previous,
  });
}
