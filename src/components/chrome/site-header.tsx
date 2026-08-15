"use client";

import Link from "next/link";
import { REPO_URL } from "@/lib/links";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { AboutModal } from "./about-modal";
import { AuthModal } from "./auth-modal";

/**
 * The header carries the two things that are about the site rather than the
 * screen: where the code is, and who you are.
 *
 * The theme picker is deliberately not one of them. It is a preference set
 * once, and it kept a permanent control in a bar that has to stay quiet —
 * while `t` and `/theme` reach it from anywhere, which is the idiom the rest
 * of this product is built on.
 */
export function SiteHeader() {
  const { aboutOpen, authOpen, openAuth } = useUi();
  const user = useSession((s) => s.user);

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
          {/* A real anchor, not a button that navigates: middle-click and
              "open in new tab" have to work, and this leaves the site.

              It opens the repository — it cannot star it. GitHub has no URL
              that stars on click; the star lives behind their own button and
              needs you signed in to them. So the label asks rather than
              claims, and `star` is what you do when you get there. */}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="star this repo on github"
            className="whitespace-nowrap border border-term-line px-2 py-[3px] hover:border-term-accent hover:text-term-fg"
          >
            ★ star this repo
          </a>
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
