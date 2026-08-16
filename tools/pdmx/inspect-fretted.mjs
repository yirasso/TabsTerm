/**
 * Etapa 0, phase C: what are the already-fretted scores, actually? Splits them
 * by instrument (a 4-string "guitar" is a ukulele) and eyeballs the titles for
 * the licence problem — MuseScore's "public domain" flag is user-declared.
 *
 *   node tools/pdmx/inspect-fretted.mjs
 */
import { globSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import * as alphaTab from "@coderline/alphatab";
import { at } from "./paths.mjs";

const INDEX = JSON.parse(readFileSync(at("usable-index.json"), "utf8"));
const OUT = at("pilot-fretted.json");

/** Tuning fingerprints, low string last as alphaTab reports them. */
const FAMILIES = [
  { name: "guitar (6)", test: (t) => t.length === 6 },
  { name: "bass (4/5)", test: (t) => (t.length === 4 || t.length === 5) && Math.min(...t) <= 43 },
  { name: "ukulele/mandolin (4)", test: (t) => t.length === 4 },
  { name: "other", test: () => true },
];

const familyOf = (t) => FAMILIES.find((f) => f.test(t))?.name ?? "other";

/** Bands and moderns that cannot plausibly be public domain. */
const SUSPECT_GENRE = /rock|pop|soundtrack|electronic|hiphop|rnb|metal|country|reggae/i;

const rows = [];

for (const file of globSync(at("extracted/mxl/**/*.mxl"))) {
  const rel = file.replace(/\\/g, "/").replace(`${at("extracted")}/`, "");
  const meta = INDEX[rel] ?? {};
  let score;
  try {
    score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(readFileSync(file)));
  } catch {
    continue;
  }

  let notes = 0;
  let withFret = 0;
  let tuning = [];
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      if (!staff.isStringed || staff.tuning.length === 0) continue;
      if (tuning.length === 0) tuning = [...staff.tuning];
      for (const bar of staff.bars)
        for (const voice of bar.voices)
          for (const beat of voice.beats)
            for (const note of beat.notes) {
              notes++;
              if (note.string >= 0 && note.fret >= 0) withFret++;
            }
    }
  }
  if (notes === 0 || withFret / notes < 0.95) continue;

  rows.push({
    title: (meta.title || score.title || "").slice(0, 70),
    composer: (meta.composer || score.music || "").slice(0, 40),
    genres: meta.genres ?? "",
    licence: meta.licence ?? "",
    family: familyOf(tuning),
    tuning: tuning.join(","),
    bars: score.masterBars.length,
    notes,
    suspect: SUSPECT_GENRE.test(meta.genres ?? ""),
  });
}

const byFamily = new Map();
for (const r of rows) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + 1);

const guitars = rows.filter((r) => r.family === "guitar (6)");
const suspect = rows.filter((r) => r.suspect);

await writeFile(OUT, JSON.stringify({ total: rows.length, rows }, null, 2));

console.log(`\n=== ${rows.length} already-fretted scores ===\n`);
for (const [fam, n] of [...byFamily].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${fam.padEnd(24)} ${n}`);
}

console.log(`\n  genre flagged as modern/copyrighted: ${suspect.length} of ${rows.length}`);
console.log(`\n--- 25 six-string guitar titles ---`);
for (const r of guitars.slice(0, 25)) {
  console.log(`  ${r.title.padEnd(46)} | ${r.composer.padEnd(26)} | ${r.genres || "-"}`);
}
console.log(`\n--- 12 flagged as modern ---`);
for (const r of suspect.slice(0, 12)) {
  console.log(`  ${r.title.padEnd(46)} | ${r.genres}`);
}
console.log(`\nwrote ${OUT}\n`);
