/**
 * Etapa 0, phase E: the ceiling. Applies the same positive-proof licence test
 * to all 1,439 usable scores, not just the already-fretted ones — because that
 * is what the catalog could reach IF the fretting pass gets written.
 *
 *   node tools/pdmx/ceiling.mjs
 */
import { readFileSync } from "node:fs";

const INDEX = JSON.parse(readFileSync("C:/Dev/_pdmx/usable-index.json", "utf8"));
const FRETTED = new Set(
  JSON.parse(readFileSync("C:/Dev/_pdmx/pilot-fretted.json", "utf8")).rows.map((r) => r.title),
);

const PD_DEATH_YEAR = 1955;
const LIFESPAN = /\(?\b(1\d{3})\s*[-–—]\s*(1\d{3})\b\)?/;
const TRADITIONAL = /\b(trad\.?|traditional|anon\.?|anonymous|folk\s*song|popular)\b/i;
const ARRANGER_ONLY = /\b(arr\.?|arranged|arrangement|transcri|adapt)/i;

function isPublicDomain(title, composer) {
  const hay = `${composer} ${title}`;
  const span = LIFESPAN.exec(hay);
  if (span) return Number(span[2]) <= PD_DEATH_YEAR;
  return TRADITIONAL.test(hay) && !ARRANGER_ONLY.test(composer);
}

let total = 0;
let pd = 0;
let pdFretted = 0;
const pdGenres = new Map();

for (const meta of Object.values(INDEX)) {
  total++;
  const title = meta.title || meta.songName || "";
  if (!isPublicDomain(title, meta.composer ?? "")) continue;
  pd++;
  if (FRETTED.has(title.slice(0, 70))) pdFretted++;
  for (const g of (meta.genres ?? "").split("-")) {
    if (g && g !== "NA") pdGenres.set(g, (pdGenres.get(g) ?? 0) + 1);
  }
}

const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;

console.log(`\n=== ceiling over all ${total.toLocaleString()} usable scores ===\n`);
console.log(`  positively public domain     ${pd}  (${pct(pd, total)})`);
console.log(`  …already fretted             ${pdFretted}`);
console.log(`  …would need a fretting pass  ${pd - pdFretted}`);
console.log(
  `\n  genres: ${[...pdGenres]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g, n]) => `${g}=${n}`)
    .join(", ")}`,
);
console.log(`\n  So the fretting pass buys roughly ${pd - pdFretted} extra songs.\n`);
