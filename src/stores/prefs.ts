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
