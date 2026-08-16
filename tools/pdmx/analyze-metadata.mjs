/**
 * Etapa 0, phase A: what does PDMX actually contain, before downloading a
 * single score? Streams PDMX.csv and prints the funnel that decides whether
 * this catalog is 300 songs or 5,000.
 *
 *   node tools/pdmx/analyze-metadata.mjs [pathToPDMX.csv]
 */
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { parse } from "csv-parse";
import { BASS_PROGRAMS, GUITAR_PROGRAMS, PROGRAM_NAMES, parseTracks } from "./gm.mjs";
import { at } from "./paths.mjs";

const CSV = process.argv[2] ?? at("PDMX.csv");
const OUT = at("pilot-metadata.json");

const isTrue = (v) => v === "True" || v === "true";

/** Uploader noise we would have to strip before showing a title. */
const JUNK_TITLE =
  /\b(easy|tutorial|piano tutorial|sheet music|for beginners|arrangement|arr\.|cover|midi|guitar pro|synthesia|slow|tabs?)\b|[[(]\s*(easy|hard|medium|tutorial)\s*[\])]|^\s*untitled/i;

const counters = {
  total: 0,
  allValid: 0,
  noLicenseConflict: 0,
  deduplicated: 0,
  bestUniqueArrangement: 0,
  hasGuitar: 0,
  guitarLed: 0,
  guitarOnly: 0,
  hasBass: 0,
  soloGuitar: 0,
  // The stack that actually matters: valid + clean licence + guitar-led + unique.
  usable: 0,
  usableWithMxl: 0,
  usableRated: 0,
  usableJunkTitle: 0,
};

const licences = new Map();
const genres = new Map();
const programHistogram = new Map();
const complexity = new Map();
const usableTitles = new Set();
let usableDuplicateTitles = 0;

const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

const parser = createReadStream(CSV).pipe(
  parse({ columns: true, skip_empty_lines: true, relax_quotes: true }),
);

for await (const row of parser) {
  counters.total++;

  const valid = isTrue(row["subset:all_valid"]);
  const cleanLicence = isTrue(row["subset:no_license_conflict"]);
  const unique = isTrue(row.is_best_unique_arrangement);

  if (valid) counters.allValid++;
  if (cleanLicence) counters.noLicenseConflict++;
  if (isTrue(row["subset:deduplicated"])) counters.deduplicated++;
  if (unique) counters.bestUniqueArrangement++;

  const tracks = parseTracks(row.tracks);
  const guitars = tracks.filter((p) => GUITAR_PROGRAMS.has(p));
  const basses = tracks.filter((p) => BASS_PROGRAMS.has(p));

  if (guitars.length > 0) {
    counters.hasGuitar++;
    for (const p of guitars) bump(programHistogram, PROGRAM_NAMES[p] ?? String(p));
  }
  if (basses.length > 0) counters.hasBass++;

  // "Led" = guitar is at least half the parts, so a four-bar cameo in an
  // orchestral score does not count as a guitar tab.
  const guitarLed = tracks.length > 0 && guitars.length * 2 >= tracks.length;
  const guitarOnly = tracks.length > 0 && guitars.length === tracks.length;
  if (guitarLed) counters.guitarLed++;
  if (guitarOnly) counters.guitarOnly++;
  if (guitarOnly && tracks.length === 1) counters.soloGuitar++;

  if (valid && cleanLicence && guitarLed && unique) {
    counters.usable++;
    if (row.mxl && row.mxl !== "NA") counters.usableWithMxl++;
    if (isTrue(row["subset:rated"])) counters.usableRated++;

    const title = (row.title ?? row.song_name ?? "").trim();
    if (JUNK_TITLE.test(title)) counters.usableJunkTitle++;

    const key = `${title.toLowerCase()}|${(row.composer_name ?? "").toLowerCase()}`;
    if (usableTitles.has(key)) usableDuplicateTitles++;
    else usableTitles.add(key);

    bump(licences, row.license ?? "NA");
    bump(complexity, row.complexity ?? "NA");
    for (const g of (row.genres ?? "").split("-")) if (g && g !== "NA") bump(genres, g);
  }

  if (counters.total % 50_000 === 0) {
    process.stderr.write(`  …${counters.total.toLocaleString()} rows\n`);
  }
}

const pct = (n) => `${((n / counters.total) * 100).toFixed(1)}%`;
const top = (map, n = 10) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const report = {
  csv: CSV,
  counters,
  usableDistinctTitles: usableTitles.size,
  usableDuplicateTitles,
  topLicences: top(licences),
  topGenres: top(genres),
  guitarPrograms: top(programHistogram),
  complexity: top(complexity),
};

await writeFile(OUT, JSON.stringify(report, null, 2));

console.log(`\n=== PDMX metadata funnel (${counters.total.toLocaleString()} songs) ===\n`);
console.log(
  `  all_valid                 ${counters.allValid.toLocaleString()} (${pct(counters.allValid)})`,
);
console.log(
  `  no_license_conflict       ${counters.noLicenseConflict.toLocaleString()} (${pct(counters.noLicenseConflict)})`,
);
console.log(
  `  best_unique_arrangement   ${counters.bestUniqueArrangement.toLocaleString()} (${pct(counters.bestUniqueArrangement)})`,
);
console.log(
  `\n  has any guitar part       ${counters.hasGuitar.toLocaleString()} (${pct(counters.hasGuitar)})`,
);
console.log(
  `  guitar-led (>=half)       ${counters.guitarLed.toLocaleString()} (${pct(counters.guitarLed)})`,
);
console.log(
  `  guitar only               ${counters.guitarOnly.toLocaleString()} (${pct(counters.guitarOnly)})`,
);
console.log(
  `  solo guitar (1 track)     ${counters.soloGuitar.toLocaleString()} (${pct(counters.soloGuitar)})`,
);
console.log(
  `  has bass part             ${counters.hasBass.toLocaleString()} (${pct(counters.hasBass)})`,
);
console.log(
  `\n  >>> USABLE                ${counters.usable.toLocaleString()} (${pct(counters.usable)})`,
);
console.log(`      (valid + clean licence + guitar-led + unique arrangement)`);
console.log(`      with an .mxl file     ${counters.usableWithMxl.toLocaleString()}`);
console.log(
  `      distinct title+composer ${usableTitles.size.toLocaleString()} (${usableDuplicateTitles.toLocaleString()} collisions)`,
);
console.log(`      rated by users        ${counters.usableRated.toLocaleString()}`);
console.log(`      junk-looking title    ${counters.usableJunkTitle.toLocaleString()}`);
console.log(
  `\n  licences: ${top(licences, 5)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}`,
);
console.log(
  `  genres:   ${top(genres, 8)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}`,
);
console.log(
  `  guitars:  ${top(programHistogram, 8)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}`,
);
console.log(`\nwrote ${OUT}\n`);
