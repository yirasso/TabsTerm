export type Command = { name: string; hint: string };

/** Slash commands surfaced in the prompt and the ⌘K palette. */
export const COMMANDS: Command[] = [
  { name: "/tab <song>", hint: "open the matching tab" },
  { name: "/chords <song>", hint: "chord sheets only" },
  { name: "/artist <name>", hint: "search by artist" },
  { name: "/fav", hint: "list favorited tabs" },
  { name: "/login", hint: "account: login or signup" },
  { name: "/man", hint: "what tabsterm is" },
  { name: "/theme", hint: "cycle theme" },
];

/** Idle-prompt ghost phrases. Only songs that exist in the local library. */
export const GHOSTS = [
  "greensleeves",
  "house of the rising sun",
  "/tab ode to joy",
  "scarborough fair",
  "/man",
];

const SEARCH_COMMANDS = ["/tab", "/chords", "/artist"];

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
