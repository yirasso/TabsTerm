export type Command = { name: string; hint: string };

/**
 * Commands that route to another page. The prompt must NOT be cleared for
 * these: clearing writes the URL through nuqs, and that write lands after the
 * router push and clobbers it back to `/`. The destination does not read `q`
 * anyway, so leaving it alone is both correct and simpler.
 */
export const LEAVES_PROMPT = new Set(["/rand", "/new"]);

/**
 * Slash commands, surfaced under the prompt as you type one.
 *
 * None of them takes an argument any more. Searching is what the prompt does
 * when you simply type — `/tab <song>` was a longer way to say the same thing,
 * and a command that only restates the default is a thing to learn for nothing.
 */
export const COMMANDS: Command[] = [
  { name: "/new", hint: "write a tab, by hand or from audio" },
  { name: "/list", hint: "every tab you have" },
  { name: "/rand", hint: "open a tab at random" },
  { name: "/man", hint: "what tabsterm is" },
  { name: "/theme", hint: "cycle theme" },
];

/** Idle-prompt ghost phrases. Only songs that exist in the local library. */
export const GHOSTS = [
  "greensleeves",
  "house of the rising sun",
  "ode to joy",
  "scarborough fair",
  "/new",
];

export function parseCommand(q: string): { cmd: string; arg: string } | null {
  const m = /^\/(\S+)\s*(.*)$/.exec(q.trim());
  if (!m) return null;
  return { cmd: `/${m[1]}`, arg: (m[2] ?? "").trim() };
}

/**
 * The term actually sent to the search API for a given prompt input.
 *
 * Anything starting with a slash is a command, and no command searches — so a
 * half-typed or unrecognised one searches for nothing rather than quietly
 * looking up its own name.
 */
export function searchTermFor(q: string): string {
  return parseCommand(q) ? "" : q.trim();
}
