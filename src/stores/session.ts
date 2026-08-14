"use client";

import { create } from "zustand";

/** Mock account, per the design: client-side only, nothing leaves the browser. */
export type SessionUser = { email: string; handle: string };

type SessionState = {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
};

export const useSession = create<SessionState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
