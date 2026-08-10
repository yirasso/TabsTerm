"use client";

import { create } from "zustand";
import type { SongSummary } from "@/server/tabs/types";

/** Mock account, per the design: client-side only, nothing leaves the browser. */
export type SessionUser = { email: string; handle: string };

export type FavEntry = Pick<
  SongSummary,
  "provider" | "id" | "title" | "artist" | "type" | "capability"
>;

export function favKey(entry: Pick<FavEntry, "provider" | "id">) {
  return `${entry.provider}:${entry.id}`;
}

type SessionState = {
  user: SessionUser | null;
  /** In memory on purpose — the design promises "favorites live in this session only". */
  favs: FavEntry[];
  login: (user: SessionUser) => void;
  logout: () => void;
  toggleFav: (entry: FavEntry) => void;
};

export const useSession = create<SessionState>((set) => ({
  user: null,
  favs: [],
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
  toggleFav: (entry) =>
    set((s) => {
      const key = favKey(entry);
      const exists = s.favs.some((f) => favKey(f) === key);
      return {
        favs: exists ? s.favs.filter((f) => favKey(f) !== key) : [...s.favs, entry],
      };
    }),
}));
