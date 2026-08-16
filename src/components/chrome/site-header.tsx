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
            className="group flex items-center gap-1.5 whitespace-nowrap rounded-full border border-term-line bg-term-panel py-[3px] pr-2.5 pl-2 hover:border-term-accent hover:text-term-fg"
          >
            {/* The mark says where the link goes without spending a word on it,
                which is what lets the label be one word instead of four. */}
            <GithubMark />
            star
            {/* Explicitly accent, which the link already is — until it is
                hovered, where `a:hover` takes the rest to `--tt-fg` and the
                star is the one thing that stays gold. */}
            <span className="text-term-accent">★</span>
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

/**
 * GitHub's mark, inline and in `currentColor` so it takes the link's colour
 * and its hover with it. Inline rather than an `<img>` because it is 13px of
 * chrome — a request for it would cost more than the path does.
 */
function GithubMark() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative, and the link it sits in is already labelled — a title here would announce the destination twice
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="currentColor"
      className="flex-none"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
