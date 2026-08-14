"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";

/**
 * The design's mock account flow. Validation and "session" are entirely
 * client-side; nothing is transmitted or persisted anywhere.
 */
export function AuthModal() {
  const closeAuth = useUi((s) => s.closeAuth);
  const { user, login, logout } = useSession();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeAuth();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closeAuth]);

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, []);

  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("err: email malformed");
    if (pass.length < 8) return setError("err: passwd needs 8+ chars");
    if (mode === "signup" && !/^[a-z0-9._-]{3,}$/.test(handle.trim()))
      return setError("err: handle must be lowercase, 3+ chars");
    login({
      email: email.trim(),
      handle: handle.trim() || (email.trim().split("@")[0] ?? "user"),
    });
    closeAuth();
  };

  const onFieldKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const authCmd = user ? "whoami" : mode === "signup" ? "auth signup" : "auth login";

  return (
    <div className="fixed inset-0 z-[22] flex items-start justify-center pt-[16vh]">
      <button
        type="button"
        aria-label="close"
        onClick={closeAuth}
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
          <span className="text-[12px] text-term-dim">{authCmd}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={closeAuth}
            className="whitespace-nowrap text-[11px] text-term-faint"
          >
            esc
          </button>
        </div>

        {user ? (
          <div className="px-3.5 pb-3.5 pt-4">
            <pre className="mb-3.5 whitespace-pre-wrap text-[12px] leading-[1.8] text-term-dim">{`session   active
user      ${user.email}
plan      free`}</pre>
            <button
              type="button"
              onClick={() => {
                logout();
                closeAuth();
              }}
              className="w-full border border-term-line px-3 py-2 text-center text-[12px] hover:border-term-accent hover:text-term-accent"
            >
              logout
            </button>
          </div>
        ) : (
          <div className="p-3.5">
            <div className="mb-4 flex border border-term-line text-[12px]">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`flex-1 py-1.5 text-center ${mode === "login" ? "tt-selected text-term-fg" : "text-term-faint"}`}
              >
                login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                className={`flex-1 py-1.5 text-center ${mode === "signup" ? "tt-selected text-term-fg" : "text-term-faint"}`}
              >
                signup
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-baseline gap-[9px] border-b border-term-line pb-1.5">
                <span className="w-16 flex-none text-[11px] text-term-faint">email</span>
                <input
                  ref={emailRef}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyDown={onFieldKey}
                  placeholder="you@domain.tld"
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] caret-term-accent outline-none"
                />
              </label>
              <label className="flex items-baseline gap-[9px] border-b border-term-line pb-1.5">
                <span className="w-16 flex-none text-[11px] text-term-faint">passwd</span>
                <input
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value);
                    setError("");
                  }}
                  onKeyDown={onFieldKey}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] caret-term-accent outline-none"
                />
              </label>
              {mode === "signup" && (
                <label className="flex items-baseline gap-[9px] border-b border-term-line pb-1.5">
                  <span className="w-16 flex-none text-[11px] text-term-faint">handle</span>
                  <input
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value);
                      setError("");
                    }}
                    onKeyDown={onFieldKey}
                    placeholder="lowercase, no spaces"
                    spellCheck={false}
                    autoComplete="off"
                    className="min-w-0 flex-1 border-0 bg-transparent text-[13px] caret-term-accent outline-none"
                  />
                </label>
              )}
            </div>

            <div className="mt-2.5 min-h-[17px] text-[11px] text-term-accent">{error}</div>

            <button
              type="button"
              onClick={submit}
              className="mt-1.5 w-full border border-term-fg px-3 py-[9px] text-center text-[12px] hover:border-term-accent hover:text-term-accent"
            >
              {mode === "signup" ? "create account →" : "sign in →"}
            </button>

            <div className="mt-3.5 flex flex-wrap gap-3.5 text-[11px] text-term-faint">
              <span className="whitespace-nowrap">
                <span className="text-term-dim">enter</span> submit
              </span>
              <span className="whitespace-nowrap">
                <span className="text-term-dim">tab</span> next field
              </span>
              <span className="whitespace-nowrap">no email confirmation</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
