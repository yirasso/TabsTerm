/**
 * Etapa 0, phase D — the finding that decides the plan.
 *
 * PDMX is published as a public-domain corpus, but the flag it inherits from
 * MuseScore is declared by uploaders, and uploaders are wrong. The fretted set
 * contains Radiohead, The Police, Mariah Carey and several game soundtracks,
 * all labelled cc-zero.
 *
 * So: of the already-fretted scores, how many can we *positively* establish are
 * public domain, rather than merely labelled so? Anything we cannot establish
 * is unusable, because the burden runs the other way.
 *
 *   node tools/pdmx/verify-licence.mjs
 */
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { at } from "./paths.mjs";

const FRETTED = JSON.parse(readFileSync(at("pilot-fretted.json"), "utf8")).rows;
const OUT = at("pilot-licence.json");

/** Life+70 clears in 2026 for anyone who died in 1955 or earlier. */
const PD_DEATH_YEAR = 1955;
const LIFESPAN = /\(?\b(1\d{3})\s*[-–—]\s*(1\d{3})\b\)?/;
const TRADITIONAL =
  /\b(trad\.?|traditional|anon\.?|anonymous|folk\s*song|popular|domínio público)\b/i;
/** Uploader-attributed arrangers tell us nothing about the underlying work. */
const ARRANGER_ONLY = /\b(arr\.?|arranged|arrangement|transcri|adapt)/i;

function classify(row) {
  const hay = `${row.composer} ${row.title}`;

  const span = LIFESPAN.exec(hay);
  if (span) {
    const died = Number(span[2]);
    return died <= PD_DEATH_YEAR
      ? { verdict: "pd-dated", why: `composer died ${died}` }
      : { verdict: "copyright-dated", why: `composer died ${died}` };
  }

  if (TRADITIONAL.test(hay) && !ARRANGER_ONLY.test(row.composer)) {
    return { verdict: "pd-traditional", why: "traditional/anonymous" };
  }

  return { verdict: "unverified", why: "no death date, not marked traditional" };
}

const buckets = new Map();
const rows = FRETTED.map((r) => {
  const c = classify(r);
  buckets.set(c.verdict, (buckets.get(c.verdict) ?? 0) + 1);
  return { ...r, ...c };
});

const guitar = rows.filter((r) => r.family === "guitar (6)");
const pdGuitar = guitar.filter((r) => r.verdict.startsWith("pd-"));

await writeFile(OUT, JSON.stringify({ rows }, null, 2));

console.log(`\n=== licence reality check over ${rows.length} fretted scores ===\n`);
for (const [v, n] of [...buckets].sort((a, b) => b[1] - a[1])) {
  console.log(
    `  ${v.padEnd(20)} ${String(n).padStart(4)}  (${((n / rows.length) * 100).toFixed(1)}%)`,
  );
}

console.log(`\n  six-string guitar, fretted:            ${guitar.length}`);
console.log(`  …of those, positively public domain:   ${pdGuitar.length}`);

console.log(`\n--- 20 that survive everything ---`);
for (const r of pdGuitar.slice(0, 20)) {
  console.log(`  ${r.title.slice(0, 52).padEnd(54)} | ${r.why}`);
}

console.log(`\n--- 10 labelled public domain that plainly are not ---`);
for (const r of rows.filter((r) => r.verdict === "copyright-dated").slice(0, 10)) {
  console.log(`  ${r.title.slice(0, 52).padEnd(54)} | ${r.why} | licence=${r.licence}`);
}
console.log(`\nwrote ${OUT}\n`);
