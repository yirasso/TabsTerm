"use client";

import { CommandLine } from "@/components/chrome/command-line";
import { useUi } from "@/stores/ui";

/**
 * What `/new` shows to somebody who is not signed in.
 *
 * Reading needs no account and never will. Writing does, and for a plain
 * reason: a tab written without one has nowhere to be kept. It would sit in a
 * browser, look saved, and be gone with the site data — which is worse than
 * being asked to sign in first, because it fails later and quietly.
 *
 * This only stands where there *is* an account server. A build with none has
 * no account to ask for, and keeps writing to this browser exactly as the app
 * always did.
 */
export function SignInToWrite() {
  const openAuth = useUi((s) => s.openAuth);

  return (
    <main className="mx-auto max-w-[980px] px-[22px] pt-7">
      <CommandLine>tab --new</CommandLine>

      <pre className="mt-6 whitespace-pre-wrap text-[13px] text-term-dim leading-[1.9]">
        {`writing a tab needs an account.

  · it is saved to your account, not to this browser
  · it follows you between devices
  · nobody else ever sees it`}
      </pre>

      <button
        type="button"
        onClick={() => openAuth()}
        className="mt-[22px] border border-term-fg px-3 py-[9px] text-[12px] hover:border-term-accent hover:text-term-accent"
      >
        sign in with google →
      </button>

      <p className="mt-4 text-[11px] text-term-faint">
        reading needs no account — the library is open to everyone.
      </p>
    </main>
  );
}
