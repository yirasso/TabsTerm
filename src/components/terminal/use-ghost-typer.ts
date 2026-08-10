"use client";

import { useEffect, useState } from "react";
import { GHOSTS } from "./commands";

/**
 * The design's idle-prompt animation: type a phrase (62ms/char), hold 1.6s,
 * erase (26ms, two chars a step), move to the next phrase.
 */
export function useGhostTyper(active: boolean) {
  const [ghost, setGhost] = useState("");

  useEffect(() => {
    if (!active) {
      setGhost("");
      return;
    }
    let idx = 0;
    let i = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const phrase = GHOSTS[idx % GHOSTS.length] ?? "";
      if (!erasing) {
        i += 1;
        setGhost(phrase.slice(0, i));
        if (i >= phrase.length) {
          erasing = true;
          timer = setTimeout(step, 1600);
          return;
        }
        timer = setTimeout(step, 62);
      } else {
        i -= 2;
        setGhost(phrase.slice(0, Math.max(0, i)));
        if (i <= 0) {
          erasing = false;
          idx += 1;
          i = 0;
          timer = setTimeout(step, 400);
          return;
        }
        timer = setTimeout(step, 26);
      }
    };

    timer = setTimeout(step, 700);
    return () => clearTimeout(timer);
  }, [active]);

  return ghost;
}
