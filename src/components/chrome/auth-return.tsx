"use client";

import { useEffect } from "react";
import { useUi } from "@/stores/ui";

/**
 * Catches a sign-in that came back broken.
 *
 * `/auth/callback` sends failures home as `?auth=failed`, and the home screen
 * is indistinguishable from one nobody tried to sign in from. This turns that
 * back into something a person can read, then takes the parameter out of the
 * URL so a refresh does not reopen it.
 *
 * It reads `window.location` rather than `useSearchParams` (or nuqs, which uses
 * it) deliberately. This component lives in the layout, and anything in the
 * layout that reads the query string makes every statically prerendered page —
 * `/404` included — fail the build unless it is wrapped in Suspense. The
 * parameter is a one-shot signal from a redirect, not reactive state, so
 * reading it once after mount is the whole requirement.
 */
export function AuthReturn() {
  const openAuth = useUi((s) => s.openAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "failed") return;

    openAuth("err: sign-in did not complete");

    params.delete("auth");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [openAuth]);

  return null;
}
