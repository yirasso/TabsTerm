"use client";

import { create } from "zustand";

/**
 * Who is signed in, as the rest of the app reads it.
 *
 * The store is deliberately dumb: it holds an answer, and `SessionSync` is the
 * only thing that writes one. Supabase is the source of truth, and a second
 * component reaching for it would be a second answer to the same question.
 */
export type SessionUser = {
  id: string;
  email: string | null;
  /** From `profiles`, so a de-duplicated handle shows as the person's own. */
  handle: string;
};

type SessionState = {
  /**
   * `undefined` until the first read comes back, and that is not the same as
   * `null`. Signed out is an answer; not knowing yet is not, and the modal says
   * so rather than flashing "sign in" at somebody who is already signed in.
   */
  user: SessionUser | null | undefined;
  setUser: (user: SessionUser | null) => void;
};

export const useSession = create<SessionState>((set) => ({
  user: undefined,
  setUser: (user) => set({ user }),
}));
