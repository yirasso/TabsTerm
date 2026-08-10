"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TabView } from "@/components/tab/tab-view";
import { type Draft, draftToTab, useDrafts } from "@/stores/drafts";

/**
 * Reads a locally-stored draft with the same view the catalog uses, so a writer
 * sees exactly what a reader will — including the player.
 */
export function DraftScreen({ id }: { id: string }) {
  const getDraft = useDrafts((s) => s.get);
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);

  // localStorage is not readable during render on the server pass.
  useEffect(() => {
    setDraft(getDraft(id));
  }, [id, getDraft]);

  if (draft === undefined) {
    return (
      <main className="mx-auto max-w-[900px] px-[22px] pt-7">
        <p className="text-[11px] text-term-faint">loading draft…</p>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-[820px] flex-col justify-center px-[22px]">
        <div className="text-term-dim">
          <span className="text-term-accent">$</span> open draft/{id}
        </div>
        <pre className="mt-2 whitespace-pre-wrap text-[13px] text-term-dim leading-[1.9]">
          {`no such draft in this browser.

  · drafts are stored locally, so they do not follow you between devices
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
    <>
      <div className="mx-auto max-w-[900px] px-[22px] pt-7">
        <Link
          href={`/new?id=${draft.id}` as Route}
          className="text-[11px] text-term-faint hover:text-term-accent"
        >
          ← keep editing
        </Link>
      </div>
      <TabView tab={draftToTab(draft)} backHref={"/" as Route} />
    </>
  );
}
