"use client";

import { create } from "zustand";

type UiState = {
  aboutOpen: boolean;
  authOpen: boolean;
  /** Why the account modal opened by itself, when it did. */
  authError: string | null;
  openAbout: () => void;
  closeAbout: () => void;
  openAuth: (error?: string) => void;
  closeAuth: () => void;
};

export const useUi = create<UiState>((set) => ({
  aboutOpen: false,
  authOpen: false,
  authError: null,
  openAbout: () => set({ aboutOpen: true, authOpen: false }),
  closeAbout: () => set({ aboutOpen: false }),
  openAuth: (error) => set({ authOpen: true, aboutOpen: false, authError: error ?? null }),
  closeAuth: () => set({ authOpen: false, authError: null }),
}));

/** Read outside React (keyboard handlers) without subscribing. */
export function anyModalOpen() {
  const s = useUi.getState();
  return s.aboutOpen || s.authOpen;
}
