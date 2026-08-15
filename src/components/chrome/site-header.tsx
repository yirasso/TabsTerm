"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { AboutModal } from "./about-modal";
import { AuthModal } from "./auth-modal";
import { useThemeCycle } from "./use-theme-cycle";

export function SiteHeader() {
  const { aboutOpen, authOpen, openAuth } = useUi();
  const user = useSession((s) => s.user);
  const { theme, cycle } = useThemeCycle();

  // next-themes only knows the real theme after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <header className="sticky top-0 z-[6] flex items-baseline gap-4 border-b border-term-line bg-term-bg px-[22px] py-3.5">
        {/* A real link, not a button that pushes: the wordmark is the way home,
            and middle-click, cmd-click and "open in new tab" all have to work.
            `/` with no query is deliberate — it clears `q` and `view`, so this
            always lands on the empty prompt rather than the last search. */}
        <Link
          href="/"
          className="text-[12px] text-term-fg font-bold uppercase tracking-[0.16em] hover:text-term-accent"
        >
          tabsterm
        </Link>
        <span className="text-[11px] text-term-faint">v0.4.1</span>
        <span className="flex-1" />
        <div className="flex items-center gap-3.5 text-[11px] text-term-dim">
          <button
            type="button"
            onClick={cycle}
            className="whitespace-nowrap border border-term-line px-2 py-[3px] hover:border-term-accent hover:text-term-fg"
          >
            theme: {mounted ? theme : "paper"}
          </button>
          {/* `openAuth` is wrapped rather than passed: it takes an optional
              reason, and handing it the click handler's event would file a
              MouseEvent as one. */}
          <button
            type="button"
            onClick={() => openAuth()}
            className="whitespace-nowrap border border-term-line px-2 py-[3px] hover:border-term-accent hover:text-term-fg"
          >
            {user ? `@${user.handle}` : "account"}
          </button>
        </div>
      </header>
      {aboutOpen && <AboutModal />}
      {authOpen && <AuthModal />}
    </>
  );
}
