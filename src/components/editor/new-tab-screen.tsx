"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { type Draft, emptyDraft, newDraftId, useDrafts } from "@/stores/drafts";
import { TabEditor } from "./tab-editor";

/**
 * Resolves which draft is being edited before handing over to the editor.
 *
 * Drafts live in localStorage, so nothing here can run on the server — and the
 * editor must not mount until we know whether we are creating or resuming, or
 * it would start from an empty form and then jump.
 */
export function NewTabScreen() {
  const [id, setId] = useQueryState("id");
  const getDraft = useDrafts((s) => s.get);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (id) {
      setDraft(getDraft(id) ?? emptyDraft(id));
      return;
    }
    const fresh = newDraftId();
    void setId(fresh);
    setDraft(emptyDraft(fresh));
  }, [id, getDraft, setId]);

  if (!draft) {
    return (
      <main className="mx-auto max-w-[980px] px-[22px] pt-7">
        <p className="text-[11px] text-term-faint">opening editor…</p>
      </main>
    );
  }

  return <TabEditor key={draft.id} draft={draft} />;
}
