import { COMMANDS } from "./commands";

/** Live cycle position. Null once the user types anything that is not Tab. */
export type CycleState = { candidates: string[]; index: number; applied: string } | null;

function commandWord(name: string) {
  return name.split(" ")[0] ?? name;
}

/**
 * Every string the input could become, in cycle order.
 *
 * Only command words: no command takes an argument, so there is no second step
 * to complete into. The two-step shell behaviour — complete the word, then Tab
 * again for its value — is gone with the commands that had values, and comes
 * back with the next one that does.
 */
export function completionsFor(input: string): string[] {
  if (!input.startsWith("/") || /\s/.test(input.trim())) return [];

  const partial = input.trim().toLowerCase();
  return COMMANDS.map((c) => commandWord(c.name)).filter((name) => name.startsWith(partial));
}

/**
 * One Tab press. Returns the new input and the cycle position, or null when
 * there is nothing to complete.
 *
 * Repeated Tabs advance through the candidates.
 */
export function nextCompletion(
  input: string,
  state: CycleState,
  direction: 1 | -1,
): { value: string; state: CycleState } | null {
  if (state && state.candidates.length > 1 && state.applied === input) {
    const size = state.candidates.length;
    const index = (state.index + direction + size) % size;
    const value = state.candidates[index];
    if (value === undefined) return null;
    return { value, state: { ...state, index, applied: value } };
  }

  const candidates = completionsFor(input);
  if (candidates.length === 0) return null;

  const index = direction === 1 ? 0 : candidates.length - 1;
  const value = candidates[index];
  if (value === undefined) return null;
  // A lone candidate identical to what is already typed is a no-op, not a cycle.
  if (candidates.length === 1 && value === input) return null;

  return { value, state: { candidates, index, applied: value } };
}
