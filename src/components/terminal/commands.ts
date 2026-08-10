import type { Route } from "next";

export type Command = { name: string; hint: string };

/** The picking happens on the server, so /random is a plain shareable link. */
export function randomHref(provider: string | null): Route {
  return (provider ? `/random?src=${encodeURIComponent(provider)}` : "/random") as Route;
}

/**
 * Commands that route to another page. The prompt must NOT be cleared for
 * these: clearing writes the URL through nuqs, and that write lands after the
 * router push and clobbers it back to `/`. The destination does not read `q`
 * anyway, so leaving it alone is both correct and simpler.
 */
export const LEAVES_PROMPT = new Set(["/random"]);

/** Slash commands surfaced in the prompt and the ⌘K palette. */
export const COMMANDS: Command[] = [
  { name: "/tab <song>", hint: "open the matching tab" },
  { name: "/artist <name>", hint: "search by artist" },
  { name: "/random", hint: "open a tab at random" },
  { name: "/src <name>", hint: "restrict search to one source" },
  { name: "/fav", hint: "list favorited tabs" },
  { name: "/auth", hint: "account: login or signup" },
  { name: "/man", hint: "what tabsterm is" },
  { name: "/theme", hint: "cycle theme" },
];

/** Idle-prompt ghost phrases. Only songs that exist in the local library. */
export const GHOSTS = [
  "greensleeves",
  "house of the rising sun",
  "/tab ode to joy",
  "scarborough fair",
  "/random",
];

const SEARCH_COMMANDS = ["/tab", "/artist"];

export function parseCommand(q: string): { cmd: string; arg: string } | null {
  const m = /^\/(\S+)\s*(.*)$/.exec(q.trim());
  if (!m) return null;
  return { cmd: `/${m[1]}`, arg: (m[2] ?? "").trim() };
}

/** The term actually sent to the search API for a given prompt input. */
export function searchTermFor(q: string): string {
  const c = parseCommand(q);
  if (!c) return q.trim();
  return SEARCH_COMMANDS.includes(c.cmd) ? c.arg : "";
}
