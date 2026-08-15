"use client";

import type { Route } from "next";
import Link from "next/link";
import { TabView } from "@/components/tab/tab-view";
import { useLibrary } from "@/hooks/use-library";
import { draftToTab } from "@/stores/drafts";

/**
 * Opening a tab of your own — from your account, or from this browser if you
 * have none. Which of the two is `useLibrary`'s business, not this screen's.
 *
 * It is the same screen as opening a catalog tab — same view, same player, same
 * URL shape — because a tab you wrote is a tab. What it adds is the way back
 * into the editor, which the catalog has no use for.
 */
export function MyTabScreen({ id, backHref }: { id: string; backHref: Route }) {
  // Neither store is readable during render on the server pass: one is this
  // browser's localStorage, the other is behind a session this pass has not
  // read yet.
  const library = useLibrary();
  const tab = library.ready ? library.get(id) : undefined;

  if (tab === undefined) {
    return (
      <main className="mx-auto max-w-[900px] px-[22px] pt-7">
        <p className="text-[11px] text-term-faint">opening…</p>
      </main>
    );
  }

  if (!tab) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-[820px] flex-col justify-center px-[22px]">
        <div className="text-term-dim">
          <span className="text-term-accent">$</span> open mine/{id}
        </div>
        <pre className="mt-2 whitespace-pre-wrap text-[13px] text-term-dim leading-[1.9]">
          {library.remote
            ? `no such tab in your account.

  · it may have been deleted
  · a tab written before you signed in moves across on your first sign-in`
            : `no such tab in this browser.

  · without an account your tabs are stored locally, so they do not follow you
  · if you wrote it somewhere else, it is still there`}
        </pre>
        <Link
          href="/new"
          className="mt-[22px] inline-block self-start border border-term-line px-3 py-[7px] text-[12px] text-term-fg hover:border-term-accent hover:text-term-accent"
        >
          write a new one
        </Link>
      </main>
    );
  }

  return (
    <TabView tab={draftToTab(tab)} backHref={backHref} editHref={`/new?id=${tab.id}` as Route} />
  );
}
