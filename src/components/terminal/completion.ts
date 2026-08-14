import { COMMANDS } from "./commands";

export type CompletionContext = {
  /** Titles currently on screen, so `/tab gree` can finish the song name. */
  songs?: string[];
};

/** Live cycle position. Null once the user types anything that is not Tab. */
export type CycleState = { candidates: string[]; index: number; applied: string } | null;

const SPLIT = /^(\S+)\s+([\s\S]*)$/;
const TAKES_SONG = new Set(["/tab", "/artist"]);

function commandWord(name: string) {
  return name.split(" ")[0] ?? name;
}

function argCandidates(cmd: string, ctx: CompletionContext): string[] {
  return TAKES_SONG.has(cmd) ? (ctx.songs ?? []) : [];
}

/**
 * Every string the input could become, in cycle order. Completing a command
 * that takes an argument leaves a trailing space, so the next Tab moves on to
 * completing that argument — the same two-step a shell gives you.
 */
export function completionsFor(input: string, ctx: CompletionContext): string[] {
  if (!input.startsWith("/")) return [];

  const split = SPLIT.exec(input);
  if (!split) {
    const partial = input.toLowerCase();
    return COMMANDS.filter((c) => commandWord(c.name).startsWith(partial)).map((c) =>
      c.name.includes("<") ? `${commandWord(c.name)} ` : commandWord(c.name),
    );
  }

  const [, cmd = "", argPartial = ""] = split;
  const partial = argPartial.toLowerCase();
  return argCandidates(cmd, ctx)
    .filter((value) => value.toLowerCase().startsWith(partial))
    .map((value) => `${cmd} ${value}`);
}

/**
 * One Tab press. Returns the new input and the cycle position, or null when
 * there is nothing to complete.
 *
 * Repeated Tabs advance through the candidates, except when the previous press
 * had only one candidate — then the input has moved on to a new completion
 * context (typically command word → argument) and we start over from there.
 */
export function nextCompletion(
  input: string,
  state: CycleState,
  direction: 1 | -1,
  ctx: CompletionContext,
): { value: string; state: CycleState } | null {
  if (state && state.candidates.length > 1 && state.applied === input) {
    const size = state.candidates.length;
    const index = (state.index + direction + size) % size;
    const value = state.candidates[index];
    if (value === undefined) return null;
    return { value, state: { ...state, index, applied: value } };
  }

  const candidates = completionsFor(input, ctx);
  if (candidates.length === 0) return null;

  const index = direction === 1 ? 0 : candidates.length - 1;
  const value = candidates[index];
  if (value === undefined) return null;
  // A lone candidate identical to what is already typed is a no-op, not a cycle.
  if (candidates.length === 1 && value === input) return null;

  return { value, state: { candidates, index, applied: value } };
}
