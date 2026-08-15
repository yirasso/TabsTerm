"use client";

import { useEffect, useState } from "react";
import { HANDLE_RULE, isValidHandle, renameHandle } from "@/lib/account/profile";
import { browserSupabase } from "@/lib/supabase/browser";
import { hasAccounts } from "@/lib/supabase/config";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";

/**
 * The account modal.
 *
 * Signing in has nothing to type and nothing to choose: no email, no password,
 * and no login/signup pair — for someone who has never been here those are the
 * same door. So signed out, this screen is a sentence and a button.
 *
 * Signed in it grows one field, because the handle is the only thing about an
 * account its owner can decide. It arrives derived from an email address and
 * possibly with a number stuck on the end, which is a reasonable first guess
 * and a poor last word.
 */
export function AuthModal() {
  const closeAuth = useUi((s) => s.closeAuth);
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);

  // Set by `AuthReturn` when the exchange failed, so the failure lands
  // somewhere a person can see instead of quietly leaving them signed out.
  const returnedError = useUi((s) => s.authError);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  // Seeded once, when the modal mounts with a session. Following `user.handle`
  // afterwards would rewrite the field under someone who is halfway through
  // typing a new one.
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [renamed, setRenamed] = useState(false);

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

  const rename = async () => {
    if (!user) return;

    setWorking(true);
    setError("");
    setRenamed(false);

    const result = await renameHandle(user.id, handle);
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // The database's answer, not the one that was typed: it lowercases and
    // trims, and the header should show what is actually stored.
    setHandle(result.handle);
    setUser({ ...user, handle: result.handle });
    setRenamed(true);
  };

  const wanted = handle.trim().toLowerCase();
  const canRename = wanted !== user?.handle && isValidHandle(wanted);

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
              <pre className="mb-3 whitespace-pre-wrap text-[12px] text-term-dim leading-[1.8]">{`session   active
user      ${user.email ?? "—"}`}</pre>

              {/* The one editable thing about an account. It reads as another
                  line of the block above rather than as a form, which is what
                  it is: a value you may change, not a task to complete. */}
              <div className="mb-1.5 flex items-baseline gap-[9px] border-b border-term-line pb-1.5">
                <label
                  htmlFor="account-handle"
                  className="w-16 flex-none text-[11px] text-term-faint"
                >
                  handle
                </label>
                <span className="text-[13px] text-term-faint">@</span>
                <input
                  id="account-handle"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    setError("");
                    setRenamed(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canRename) {
                      e.preventDefault();
                      void rename();
                    }
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] caret-term-accent outline-none"
                />
                <button
                  type="button"
                  onClick={() => void rename()}
                  disabled={!canRename || working}
                  className="flex-none whitespace-nowrap text-[11px] text-term-dim enabled:hover:text-term-accent disabled:text-term-faint"
                >
                  {working ? "…" : "rename"}
                </button>
              </div>
              <div className="mb-3.5 text-[11px] text-term-faint">
                {renamed ? "renamed." : HANDLE_RULE}
              </div>

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
