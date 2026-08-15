"use client";

import { browserSupabase } from "@/lib/supabase/browser";

/**
 * The handle, and changing it.
 *
 * The shape rule is written down twice on purpose: here, so somebody typing
 * gets told before they submit, and as a check constraint in the database, so
 * the rule holds for anyone who skips this screen and posts to PostgREST with
 * the publishable key. The one in the database is the one that enforces it.
 */

const SHAPE = /^[a-z0-9._-]{3,32}$/;

export const HANDLE_RULE = "lowercase · 3–32 · letters, digits, . _ -";

export function isValidHandle(handle: string) {
  return SHAPE.test(handle);
}

export type RenameResult = { ok: true; handle: string } | { ok: false; error: string };

/**
 * Rename, and answer with what the database now holds rather than with what
 * was asked for — the caller puts that into the session, and the two must not
 * be allowed to disagree.
 */
export async function renameHandle(id: string, wanted: string): Promise<RenameResult> {
  const handle = wanted.trim().toLowerCase();

  if (!isValidHandle(handle)) return { ok: false, error: `err: handle is ${HANDLE_RULE}` };

  const supabase = browserSupabase();
  if (!supabase) return { ok: false, error: "err: no account server" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ handle })
    .eq("id", id)
    .select("handle")
    .single();

  if (error) {
    // 23505 is the unique index; every other failure is worth showing as it
    // came, rather than guessing at a friendlier cause.
    if (error.code === "23505") return { ok: false, error: `err: @${handle} is taken` };
    if (error.code === "23514") return { ok: false, error: `err: handle is ${HANDLE_RULE}` };
    return { ok: false, error: `err: ${error.message}` };
  }

  return { ok: true, handle: data.handle };
}
