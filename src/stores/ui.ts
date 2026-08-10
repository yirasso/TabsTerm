"use client";

import { create } from "zustand";

type UiState = {
  aboutOpen: boolean;
  authOpen: boolean;
  paletteOpen: boolean;
  /** Bumped to ask the terminal prompt to refocus (e.g. after palette prefill). */
  promptFocusTick: number;
  openAbout: () => void;
  closeAbout: () => void;
  openAuth: () => void;
  closeAuth: () => void;
  togglePalette: () => void;
  closePalette: () => void;
  focusPrompt: () => void;
};

export const useUi = create<UiState>((set) => ({
  aboutOpen: false,
  authOpen: false,
  paletteOpen: false,
  promptFocusTick: 0,
  openAbout: () => set({ aboutOpen: true, authOpen: false, paletteOpen: false }),
  closeAbout: () => set({ aboutOpen: false }),
  openAuth: () => set({ authOpen: true, aboutOpen: false, paletteOpen: false }),
  closeAuth: () => set({ authOpen: false }),
  togglePalette: () =>
    set((s) => ({ paletteOpen: !s.paletteOpen, aboutOpen: false, authOpen: false })),
  closePalette: () => set({ paletteOpen: false }),
  focusPrompt: () => set((s) => ({ promptFocusTick: s.promptFocusTick + 1 })),
}));

/** Read outside React (keyboard handlers) without subscribing. */
export function anyModalOpen() {
  const s = useUi.getState();
  return s.aboutOpen || s.authOpen || s.paletteOpen;
}
