"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMMANDS } from "@/components/terminal/commands";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSongSearch } from "@/hooks/use-song-search";
import { useUi } from "@/stores/ui";
import { useThemeCycle } from "./use-theme-cycle";

type Item = { key: string; name: string; hint: string; run: () => void };

/** ⌘K palette — hand-rolled to match the design's markup exactly. */
export function Palette() {
  const router = useRouter();
  const { closePalette, openAbout, openAuth, focusPrompt } = useUi();
  const { cycle } = useThemeCycle();

  const [pQuery, setPQuery] = useState("");
  const [pSel, setPSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(pQuery, 200);
  const { data } = useSongSearch(debounced.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closePalette();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closePalette]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, []);

  const runCommand = (name: string) => {
    closePalette();
    if (name.includes("<")) {
      const prefix = `${name.split(" ")[0]} `;
      router.push(`/?q=${encodeURIComponent(prefix)}` as Route);
      focusPrompt();
      return;
    }
    if (name === "/fav") router.push("/?view=favs" as Route);
    else if (name === "/theme") cycle();
    else if (name === "/login") openAuth();
    else if (name === "/man") openAbout();
  };

  const t = pQuery.trim().toLowerCase();
  const songs: Item[] = (data?.results ?? []).slice(0, 4).map((s) => ({
    key: `song:${s.provider}:${s.id}`,
    name: s.title,
    hint: `open · ${s.artist}`,
    run: () => {
      closePalette();
      router.push(`/song/${s.provider}/${encodeURIComponent(s.id)}` as Route);
    },
  }));
  const cmds: Item[] = COMMANDS.filter((c) => !t || c.name.includes(t)).map((c) => ({
    key: `cmd:${c.name}`,
    name: c.name,
    hint: c.hint,
    run: () => runCommand(c.name),
  }));
  const items = [...songs, ...cmds].slice(0, 7);
  const sel = Math.min(pSel, Math.max(0, items.length - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPSel((s) => Math.min(items.length - 1, s + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setPSel((s) => Math.max(0, s - 1));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      items[sel]?.run();
    }
  };

  return (
    <div className="fixed inset-0 z-[20] flex items-start justify-center pt-[16vh]">
      <button
        type="button"
        aria-label="close"
        onClick={closePalette}
        className="tt-overlay absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
        className="tt-modal relative w-[min(560px,92vw)]"
      >
        <div className="flex gap-2.5 border-b border-term-line px-3.5 py-3">
          <span className="text-term-accent">:</span>
          <input
            ref={inputRef}
            value={pQuery}
            onChange={(e) => {
              setPQuery(e.target.value);
              setPSel(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="command or song"
            spellCheck={false}
            aria-label="command or song"
            className="flex-1 border-0 bg-transparent caret-term-accent outline-none"
          />
        </div>
        {items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            onClick={item.run}
            className={`flex w-full items-baseline gap-3 px-3.5 py-[7px] text-left ${i === sel ? "tt-selected" : ""}`}
          >
            <span className="w-3 flex-none text-term-accent">{i === sel ? "›" : " "}</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</span>
            <span className="flex-1" />
            <span className="flex-none whitespace-nowrap text-[11px] text-term-faint">
              {item.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
