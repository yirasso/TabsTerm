"use client";

import { create } from "zustand";

type UiState = {
  aboutOpen: boolean;
  authOpen: boolean;
  openAbout: () => void;
  closeAbout: () => void;
  openAuth: () => void;
  closeAuth: () => void;
};

export const useUi = create<UiState>((set) => ({
  aboutOpen: false,
  authOpen: false,
  openAbout: () => set({ aboutOpen: true, authOpen: false }),
  closeAbout: () => set({ aboutOpen: false }),
  openAuth: () => set({ authOpen: true, aboutOpen: false }),
  closeAuth: () => set({ authOpen: false }),
}));

/** Read outside React (keyboard handlers) without subscribing. */
export function anyModalOpen() {
  const s = useUi.getState();
  return s.aboutOpen || s.authOpen;
}
