"use client";

import { useTheme } from "next-themes";

export const THEME_ORDER = ["paper", "crt", "amber", "mono"] as const;
export type ThemeName = (typeof THEME_ORDER)[number];

/** Cycle paper → crt → amber → mono, per the design's theme toggle. */
export function useThemeCycle() {
  const { theme, setTheme } = useTheme();
  const current: ThemeName = THEME_ORDER.includes(theme as ThemeName)
    ? (theme as ThemeName)
    : "paper";

  const cycle = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length] ?? "paper";
    setTheme(next);
  };

  return { theme: current, cycle };
}
