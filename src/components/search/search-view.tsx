"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSongSearch } from "@/hooks/use-song-search";

export function SearchView() {
  // The query lives in the URL, so a search is shareable and survives reload.
  const [query, setQuery] = useQueryState("q", { defaultValue: "", shallow: true });
  const debounced = useDebouncedValue(query, 250);
  const { data, isFetching, isError, error } = useSongSearch(debounced);

  const showEmptyState = !isFetching && debounced.trim().length >= 2 && data?.results.length === 0;

  return (
    <section className="w-full max-w-3xl">
      <label htmlFor="song-search" className="block text-term-muted text-sm">
        search for a song
      </label>

      <div className="mt-2 flex items-center gap-2 border border-term-border bg-term-surface px-3 py-2">
        <span aria-hidden className="text-term-accent">
          &gt;
        </span>
        <input
          id="song-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="nirvana, greensleeves, ode to joy..."
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-term-fg outline-none placeholder:text-term-muted"
        />
      </div>

      <div aria-live="polite" className="mt-6 space-y-1">
        {isError && (
          <p className="text-term-error text-sm">{(error as Error).message ?? "Search failed."}</p>
        )}

        {data?.degraded.map((d) => (
          <p key={d.provider} className="text-sm text-term-warn">
            {d.provider} unavailable — showing partial results.
          </p>
        ))}

        {showEmptyState && (
          <p className="text-sm text-term-muted">No tabs found for “{debounced}”.</p>
        )}

        <ul className="divide-y divide-term-border">
          {data?.results.map((song) => (
            <li key={`${song.provider}:${song.id}`}>
              <Link
                href={`/song/${song.provider}/${encodeURIComponent(song.id)}`}
                className="flex items-baseline justify-between gap-4 py-2 hover:text-term-accent"
              >
                <span className="truncate">
                  {song.artist} <span className="text-term-muted">—</span> {song.title}
                </span>
                <span className="shrink-0 text-term-muted text-xs uppercase">
                  {song.type} · {song.provider}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {isFetching && <p className="text-sm text-term-muted">searching…</p>}
      </div>
    </section>
  );
}
