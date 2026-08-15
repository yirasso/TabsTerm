"use client";

import { type RefObject, useEffect, useRef } from "react";
import { staveAtColumn, type TabBlock } from "@/lib/tab/parse-notes";

/** Header, plus enough air above the stave that it does not read as clipped. */
const HEADROOM = 130;
/** The playback bar sits over the bottom of the page and must not cover a stave. */
const FOOTROOM = 80;

/**
 * Keeps the stave being played on screen, and returns the ref to attach to it.
 *
 * It follows the *cursor's stave*, which is the fix for the version that
 * watched `playing`: that one fired once, scrolled to the first stave, and then
 * let the cursor walk off the bottom of the window for the rest of the piece. A
 * cursor you cannot see is not a cursor.
 *
 * It also only scrolls when it has to. Snapping every stave to the top would
 * jump the page while the next one is already in plain view, which reads as the
 * page fighting you rather than following the music.
 */
export function useFollowCursor(
  blocks: TabBlock[],
  column: number,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);

  // The id, not the block: it is what changes exactly when the cursor crosses
  // into a different stave, so the effect runs once per crossing rather than
  // once per frame the cursor moves.
  const activeId = staveAtColumn(blocks, column)?.id ?? null;

  useEffect(() => {
    if (!activeId) return;
    // React attaches refs during commit, before this runs, so `current` is
    // already the stave that just became active rather than the one it left.
    const el = ref.current;
    if (!el) return;

    const box = el.getBoundingClientRect();
    if (box.top >= HEADROOM && box.bottom <= window.innerHeight - FOOTROOM) return;

    window.scrollTo({ top: Math.max(0, box.top + window.scrollY - HEADROOM), behavior: "smooth" });
  }, [activeId]);

  return ref;
}
