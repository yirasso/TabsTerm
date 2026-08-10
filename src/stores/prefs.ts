"use client";

import { create } from "zustand";

type PrefsState = {
  /** Provider id to search, or null for every provider the server enabled. */
  provider: string | null;
  setProvider: (provider: string | null) => void;
};

export const usePrefs = create<PrefsState>((set) => ({
  provider: null,
  setProvider: (provider) => set({ provider }),
}));

/** Cycle all → first → … → last → all, for the header chip. */
export function nextProvider(current: string | null, available: string[]): string | null {
  if (current === null) return available[0] ?? null;
  const at = available.indexOf(current);
  return at === -1 || at === available.length - 1 ? null : (available[at + 1] ?? null);
}
