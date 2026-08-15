"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { MY_TABS_KEY } from "@/hooks/use-library";
import { fetchMyTabs, saveMyTab } from "@/lib/library/remote";
import { useDrafts } from "@/stores/drafts";
import { useSession } from "@/stores/session";

/**
 * Moves whatever this browser is holding into the account, once.
 *
 * By the time accounts arrived there was real work in `localStorage`, and a
 * new account that ignored it would have deleted it in practice: the library
 * switches to the account the moment you sign in, and anything left behind
 * simply stops being anywhere you can see.
 *
 * Two things make this safe to run again, which it will be — on every sign-in,
 * in every tab:
 *
 *  · the upsert is keyed on `(owner, id)` and the tab keeps the id it was
 *    written with, so a second pass lands on the same row instead of handing
 *    someone their library twice;
 *  · nothing local is deleted until the account has been *re-read* and the tab
 *    found in it. A write that reported success but did not land takes the
 *    local copy with it otherwise, and that copy is the only one there is.
 */
export function AdoptLocalTabs() {
  const user = useSession((s) => s.user);
  const drafts = useDrafts((s) => s.drafts);
  const removeLocal = useDrafts((s) => s.remove);
  const queryClient = useQueryClient();

  // React runs effects again on every dependency change, and this one is slow
  // and networked. Without the guard, a second pass starts while the first is
  // still uploading.
  const running = useRef(false);

  useEffect(() => {
    if (!user || running.current) return;

    const pending = Object.values(drafts);
    if (pending.length === 0) return;

    running.current = true;

    void (async () => {
      try {
        for (const tab of pending) {
          await saveMyTab(tab, user.id);
        }

        const inAccount = new Set((await fetchMyTabs()).map((tab) => tab.id));
        for (const tab of pending) {
          if (inAccount.has(tab.id)) removeLocal(tab.id);
        }

        await queryClient.invalidateQueries({ queryKey: [MY_TABS_KEY] });
      } catch {
        // Leave every local copy exactly where it is. The next sign-in tries
        // again, and until then the work is still somewhere.
      } finally {
        running.current = false;
      }
    })();
  }, [user, drafts, removeLocal, queryClient]);

  return null;
}
