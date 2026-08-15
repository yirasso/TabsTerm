"use client";

import { browserSupabase } from "@/lib/supabase/browser";
import type { Draft } from "@/stores/drafts";

/**
 * Someone's own tabs, in their account.
 *
 * The queries live here rather than in components for the reason the rest of
 * this codebase keeps tab data out of them: a screen should ask for a tab, not
 * know where tabs are kept. What enforces the rule that these are *theirs* is
 * not any filter written below — it is row-level security, one policy per
 * table, both directions. A forgotten `.eq("owner", …)` returns their own rows
 * anyway.
 */

type Row = {
  id: string;
  title: string;
  artist: string;
  tuning: string[] | null;
  capo: number | null;
  content: string;
  published: boolean;
  updated_at: string;
};

const COLUMNS = "id, title, artist, tuning, capo, content, published, updated_at";

function toDraft(row: Row): Draft {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    type: "tab",
    tuning: row.tuning,
    capo: row.capo,
    content: row.content,
    published: row.published,
    updatedAt: Date.parse(row.updated_at),
  };
}

/** `owner` is set here and checked again by the policy; both have to agree. */
function toRow(tab: Draft, owner: string) {
  return {
    owner,
    id: tab.id,
    title: tab.title,
    artist: tab.artist,
    tuning: tab.tuning,
    capo: tab.capo,
    content: tab.content,
    published: tab.published,
  };
}

function client() {
  const supabase = browserSupabase();
  if (!supabase) throw new Error("no account server configured");
  return supabase;
}

export async function fetchMyTabs(): Promise<Draft[]> {
  const { data, error } = await client()
    .from("tabs")
    .select(COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Row[]).map(toDraft);
}

/**
 * Write a tab, whether or not it existed.
 *
 * `(owner, id)` is the primary key, so this is one statement and it is
 * idempotent — which is what makes adopting a browser's worth of tabs safe to
 * run twice. `updated_at` is left to the database trigger on purpose: the
 * library is ordered by it, and a client clock that is wrong reorders someone
 * else's work.
 */
export async function saveMyTab(tab: Draft, owner: string): Promise<void> {
  const { error } = await client()
    .from("tabs")
    .upsert(toRow(tab, owner), { onConflict: "owner,id" });
  if (error) throw new Error(error.message);
}

export async function deleteMyTab(id: string): Promise<void> {
  const { error } = await client().from("tabs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
