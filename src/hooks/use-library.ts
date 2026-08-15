"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { deleteMyTab, fetchMyTabs, saveMyTab } from "@/lib/library/remote";
import { type Draft, useDrafts } from "@/stores/drafts";
import { useSession } from "@/stores/session";

/**
 * Where your tabs are, without any screen having to know.
 *
 * One interface over two stores: an account when you are signed in, this
 * browser when you are not. That second case is not a fallback for a broken
 * first one — it is how the app worked before there were accounts and how it
 * still works for anyone who never signs in, which is why both are real rather
 * than one being a shim.
 *
 * The rule is that there is no merging: a session means the account is the
 * truth. Local tabs are moved into it once, on the first sign-in, by
 * `AdoptLocalTabs`. Two live copies of the same tab is the bug this avoids.
 */
export type Library = {
  /** False until we know who is asking; screens should wait rather than guess. */
  ready: boolean;
  /** True when the answers come from an account rather than this browser. */
  remote: boolean;
  tabs: Draft[];
  get: (id: string) => Draft | null;
  save: (tab: Draft) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const MY_TABS_KEY = "my-tabs";

export function useLibrary(): Library {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();

  const local = useDrafts((s) => s.drafts);
  const upsertLocal = useDrafts((s) => s.upsert);
  const removeLocal = useDrafts((s) => s.remove);

  const remote = Boolean(user);

  const query = useQuery({
    queryKey: [MY_TABS_KEY, user?.id],
    queryFn: fetchMyTabs,
    enabled: remote,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [MY_TABS_KEY] }),
    [queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: async (tab: Draft) => {
      if (!user) return upsertLocal(tab);
      await saveMyTab(tab, user.id);
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return removeLocal(id);
      await deleteMyTab(id);
    },
    onSuccess: invalidate,
  });

  /**
   * Stable identities, and not as a micro-optimisation.
   *
   * The editor autosaves from an effect that keeps `save` in its dependencies
   * and holds a timer. Handed a new function every render, that effect tears
   * the timer down and starts it again before it can ever fire — so nothing is
   * ever written, which is exactly how this shipped for one very instructive
   * test run. `mutateAsync` is stable, so these are too.
   */
  const { mutateAsync: runSave } = saveMutation;
  const { mutateAsync: runRemove } = removeMutation;

  const save = useCallback(
    async (tab: Draft) => {
      await runSave(tab);
    },
    [runSave],
  );

  const remove = useCallback(
    async (id: string) => {
      await runRemove(id);
    },
    [runRemove],
  );

  const tabs = useMemo(
    () =>
      remote ? (query.data ?? []) : Object.values(local).sort((a, b) => b.updatedAt - a.updatedAt),
    [remote, query.data, local],
  );

  const get = useCallback((id: string) => tabs.find((tab) => tab.id === id) ?? null, [tabs]);

  return {
    // `user === undefined` is "not known yet", which is not the same as signed
    // out — starting to read from the wrong store is how a signed-in person
    // gets shown an empty library for a moment.
    ready: user !== undefined && (!remote || !query.isPending),
    remote,
    tabs,
    get,
    save,
    remove,
  };
}
