/**
 * Re-lay the seed library onto the current grid, in place, so the shipped tabs
 * follow the same house style the editor and the transcriber produce.
 *
 *   node scripts/normalise-seeds.ts            # square up ragged content
 *   node scripts/normalise-seeds.ts --from 2   # re-lay content written at width 2
 *   node scripts/normalise-seeds.ts --rebar    # cut bars down to COLUMNS_PER_BAR
 *
 * Safe to re-run without a flag: normaliseGrid leaves content that is already
 * on the grid alone. `--from` is NOT safe to re-run — it reads every N
 * characters as one position, so pointing it at content that has already been
 * converted will chop it up. Use it once, per change to CELL_WIDTH.
 *
 * `--rebar` is safe to re-run and refuses to lose notation: it throws if a bar
 * carries notes past COLUMNS_PER_BAR rather than trimming them away.
 */
import { readFile, writeFile } from "node:fs/promises";
import { normaliseGrid, rebar, regrid } from "../src/lib/tab/grid.ts";

const FILE = new URL("../src/data/seed-tabs.ts", import.meta.url);

const flag = process.argv.indexOf("--from");
const fromWidth = flag === -1 ? null : Number(process.argv[flag + 1]);
if (flag !== -1 && !Number.isInteger(fromWidth)) {
  throw new Error("--from needs an integer width, e.g. --from 2");
}

const source = await readFile(FILE, "utf8");
let changed = 0;

// The seed contents are plain template literals with no interpolation, so a
// non-greedy match between the delimiters is unambiguous.
const rewritten = source.replace(/content: `([\s\S]*?)`,/g, (whole, content: string) => {
  const next = process.argv.includes("--rebar")
    ? rebar(content)
    : fromWidth === null
      ? normaliseGrid(content)
      : regrid(content, fromWidth);
  if (next === content) return whole;
  changed++;
  return `content: \`${next}\`,`;
});

await writeFile(FILE, rewritten);
console.log(`rewrote ${changed} seed tab${changed === 1 ? "" : "s"}`);
