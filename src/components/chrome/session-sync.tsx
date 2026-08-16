"use client";

import { useEffect } from "react";
import { browserSupabase } from "@/lib/supabase/browser";
import { type SessionUser, useSession } from "@/stores/session";

/**
 * Keeps `useSession` pointed at whoever Supabase says is signed in.
 *
 * It renders nothing and lives in the layout, so there is exactly one
 * subscription for the whole app. Sign-in happens in another tab, a token
 * expires, someone signs out — `onAuthStateChange` reports all of it, and the
 * header follows without anyone having to remember to refresh.
 *
 * Without accounts configured the answer is a plain `null`: signed out, and
 * settled, rather than a spinner waiting for a server that does not exist.
 */
export function SessionSync() {
  const setUser = useSession((s) => s.setUser);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) {
      setUser(null);
      return;
    }

    let live = true;

    /**
     * The handle comes from `profiles`, not from the email, because the trigger
     * that made it may have had to de-duplicate: the second `ada.lovelace` is
     * `ada.lovelace1`, and guessing here would show them somebody else's name.
     * The email is the fallback only if that read fails.
     */
    const load = async (id: string, email: string | null) => {
      const { data } = await supabase.from("profiles").select("handle").eq("id", id).maybeSingle();
      if (!live) return;

      const handle = data?.handle ?? email?.split("@")[0] ?? "user";
      setUser({ id, email, handle } satisfies SessionUser);
    };

    const apply = (id: string | undefined, email: string | null) => {
      if (!live) return;
      if (!id) return setUser(null);
      // Deferred out of the caller's turn on purpose. Supabase holds an
      // internal lock while it notifies listeners, and calling back into the
      // client from inside that notification can deadlock — which shows up as
      // a header that never stops saying nothing at all.
      setTimeout(() => {
        if (live) void load(id, email);
      }, 0);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) =>
      apply(session?.user?.id, session?.user?.email ?? null),
    );

    // `onAuthStateChange` is documented to report the current session as soon
    // as it subscribes, and this asks anyway. If that first event ever fails to
    // arrive the store sits at `undefined` forever, and "we do not know yet" is
    // the one state with no way out of itself.
    void supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session?.user?.id, data.session?.user?.email ?? null));

    return () => {
      live = false;
      subscription.subscription.unsubscribe();
    };
  }, [setUser]);

  return null;
}
