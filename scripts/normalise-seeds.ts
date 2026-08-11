/**
 * One-off: re-lay the seed library onto the two-character grid in place, so the
 * shipped tabs follow the same house style the editor and the transcriber
 * produce. Run with Node's built-in TypeScript support:
 *
 *   node scripts/normalise-seeds.ts
 *
 * Safe to re-run: normaliseGrid leaves content that is already on the grid
 * alone, so this is a no-op the second time.
 */
import { readFile, writeFile } from "node:fs/promises";
import { normaliseGrid } from "../src/lib/tab/grid.ts";

const FILE = new URL("../src/data/seed-tabs.ts", import.meta.url);

const source = await readFile(FILE, "utf8");
let changed = 0;

// The seed contents are plain template literals with no interpolation, so a
// non-greedy match between the delimiters is unambiguous.
const rewritten = source.replace(/content: `([\s\S]*?)`,/g, (whole, content: string) => {
  const normalised = normaliseGrid(content);
  if (normalised === content) return whole;
  changed++;
  return `content: \`${normalised}\`,`;
});

await writeFile(FILE, rewritten);
console.log(`normalised ${changed} seed tab${changed === 1 ? "" : "s"}`);
