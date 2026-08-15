"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useLibrary } from "@/hooks/use-library";
import { hasAccounts } from "@/lib/supabase/config";
import { type Draft, emptyDraft, newDraftId } from "@/stores/drafts";
import { useSession } from "@/stores/session";
import { SignInToWrite } from "./sign-in-to-write";
import { TabEditor } from "./tab-editor";

/**
 * Resolves which tab is being edited before handing over to the editor.
 *
 * The editor must not mount until we know whether we are creating or resuming,
 * or it would start from an empty form and then jump — and with an account in
 * the picture, "we do not know yet" now lasts a round trip rather than a tick.
 * Mounting early would show someone a blank editor over a tab they wrote.
 */
export function NewTabScreen() {
  const [id, setId] = useQueryState("id");
  const library = useLibrary();
  const user = useSession((s) => s.user);
  const [draft, setDraft] = useState<Draft | null>(null);

  /**
   * Writing needs an account wherever there is one to have. `user === undefined`
   * is not signed out — it is not known yet, and turning somebody away during
   * that moment would greet every signed-in writer with a sign-in screen.
   */
  const barred = hasAccounts && user === null;

  useEffect(() => {
    if (barred || !library.ready) return;

    // Resolved once per id. Every autosave refreshes the library, and without
    // this the editor would be handed a fresh copy of the tab mid-edit —
    // including its `published`, which decides whether the button says publish
    // or update and must not change under someone who is typing.
    if (id && draft?.id === id) return;

    if (id) {
      setDraft(library.get(id) ?? emptyDraft(id));
      return;
    }
    const fresh = newDraftId();
    void setId(fresh);
    setDraft(emptyDraft(fresh));
  }, [barred, id, draft?.id, library.ready, library.get, setId]);

  if (barred) return <SignInToWrite />;

  if (!draft) {
    return (
      <main className="mx-auto max-w-[980px] px-[22px] pt-7">
        <p className="text-[11px] text-term-faint">opening editor…</p>
      </main>
    );
  }

  return <TabEditor key={draft.id} draft={draft} />;
}
