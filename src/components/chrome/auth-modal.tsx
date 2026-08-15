"use client";

import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";
import { hasAccounts } from "@/lib/supabase/config";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";

/**
 * The account modal.
 *
 * With OAuth there is nothing to type and nothing to choose: no email, no
 * password, no handle, and no login/signup pair — for someone who has never
 * been here those are the same door. What is left is one action, which is why
 * this screen is a sentence and a button rather than a form.
 */
export function AuthModal() {
  const closeAuth = useUi((s) => s.closeAuth);
  const user = useSession((s) => s.user);

  // Set by `AuthReturn` when the exchange failed, so the failure lands
  // somewhere a person can see instead of quietly leaving them signed out.
  const returnedError = useUi((s) => s.authError);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const close = () => closeAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const signIn = async () => {
    const supabase = browserSupabase();
    if (!supabase) return;

    setWorking(true);
    setError("");

    // Come back to the page they were reading, not to the home screen.
    const next = `${window.location.pathname}${window.location.search}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error: failure } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    // Reached only if the redirect never happened; otherwise the page is gone.
    if (failure) {
      setWorking(false);
      setError(`err: ${failure.message}`);
    }
  };

  const signOut = async () => {
    const supabase = browserSupabase();
    if (!supabase) return;
    setWorking(true);
    await supabase.auth.signOut();
    setWorking(false);
    close();
  };

  const command = user ? "whoami" : "auth login";

  return (
    <div className="fixed inset-0 z-[22] flex items-start justify-center pt-[16vh]">
      <button
        type="button"
        aria-label="close"
        onClick={close}
        className="tt-overlay absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="account"
        className="tt-modal relative w-[min(480px,92vw)]"
      >
        <div className="flex items-baseline gap-2.5 border-b border-term-line px-3.5 py-[11px]">
          <span className="text-term-accent">$</span>
          <span className="text-[12px] text-term-dim">{command}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={close}
            className="whitespace-nowrap text-[11px] text-term-faint"
          >
            esc
          </button>
        </div>

        <div className="px-3.5 pt-4 pb-3.5">
          {!hasAccounts ? (
            <pre className="whitespace-pre-wrap text-[12px] text-term-dim leading-[1.9]">
              {`this build has no account server configured.

  · your tabs live in this browser, and stay there
  · everything works — they just do not follow you`}
            </pre>
          ) : user === undefined ? (
            <p className="text-[12px] text-term-faint">checking…</p>
          ) : user ? (
            <>
              <pre className="mb-3.5 whitespace-pre-wrap text-[12px] text-term-dim leading-[1.8]">{`session   active
user      ${user.email ?? "—"}
handle    @${user.handle}`}</pre>
              <button
                type="button"
                onClick={signOut}
                disabled={working}
                className="w-full border border-term-line px-3 py-2 text-center text-[12px] hover:border-term-accent hover:text-term-accent disabled:text-term-faint"
              >
                {working ? "…" : "logout"}
              </button>
            </>
          ) : (
            <>
              <pre className="mb-4 whitespace-pre-wrap text-[12px] text-term-dim leading-[1.9]">
                {`sign in with google to keep your tabs in an account
instead of in this browser.

  · they follow you between devices
  · nobody else ever sees them`}
              </pre>
              <button
                type="button"
                onClick={signIn}
                disabled={working}
                className="w-full border border-term-fg px-3 py-[9px] text-center text-[12px] hover:border-term-accent hover:text-term-accent disabled:text-term-faint"
              >
                {working ? "opening google…" : "continue with google →"}
              </button>
            </>
          )}

          <div className="mt-2.5 min-h-[17px] text-[11px] text-term-accent">
            {error || returnedError || ""}
          </div>
        </div>
      </div>
    </div>
  );
}
