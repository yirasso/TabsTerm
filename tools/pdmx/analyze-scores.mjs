/**
 * Etapa 0, phase B: run the usable set through alphaTab and answer the question
 * the whole plan hinges on — how many of these scores already carry string/fret
 * data, and how many are plain notation that would need a fretting pass written
 * from scratch.
 *
 *   node tools/pdmx/analyze-scores.mjs
 */
import { globSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import * as alphaTab from "@coderline/alphatab";
import { at } from "./paths.mjs";

const INDEX = JSON.parse(readFileSync(at("usable-index.json"), "utf8"));
const OUT = at("pilot-scores.json");

const files = globSync(at("extracted/mxl/**/*.mxl"));

const stats = {
  files: files.length,
  parsed: 0,
  failed: 0,
  emptyScore: 0,
  withStringedStaff: 0,
  withTabStaff: 0,
  fullyFretted: 0,
  partlyFretted: 0,
  notFretted: 0,
  standardTuning: 0,
  nonStandardTuning: 0,
  withCapo: 0,
};

const failures = [];
const fretted = [];
const tunings = new Map();
const STANDARD = "64,59,55,50,45,40";

/** Notes only carry string/fret on a stringed staff; notation staves never do. */
function fretStats(score) {
  let stringedStaves = 0;
  let tabStaves = 0;
  let notes = 0;
  let withFret = 0;
  const seenTunings = new Set();
  let capo = false;

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      if (!staff.isStringed || staff.tuning.length === 0) continue;
      stringedStaves++;
      if (staff.showTablature) tabStaves++;
      if (staff.capo > 0) capo = true;
      seenTunings.add(staff.tuning.join(","));

      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            for (const note of beat.notes) {
              notes++;
              if (note.string >= 0 && note.fret >= 0) withFret++;
            }
          }
        }
      }
    }
  }

  return { stringedStaves, tabStaves, notes, withFret, tunings: seenTunings, capo };
}

for (const [i, file] of files.entries()) {
  const rel = file.replace(/\\/g, "/").replace(`${at("extracted")}/`, "");
  const meta = INDEX[rel] ?? {};

  let score;
  try {
    score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(readFileSync(file)));
  } catch (err) {
    stats.failed++;
    if (failures.length < 20) failures.push({ rel, error: String(err).slice(0, 160) });
    continue;
  }
  stats.parsed++;

  if (!score.tracks?.length || !score.masterBars?.length) {
    stats.emptyScore++;
    continue;
  }

  const f = fretStats(score);
  if (f.stringedStaves === 0) {
    stats.notFretted++;
    continue;
  }
  stats.withStringedStaff++;
  if (f.tabStaves > 0) stats.withTabStaff++;
  if (f.capo) stats.withCapo++;
  for (const t of f.tunings) {
    tunings.set(t, (tunings.get(t) ?? 0) + 1);
    if (t === STANDARD) stats.standardTuning++;
    else stats.nonStandardTuning++;
  }

  const ratio = f.notes > 0 ? f.withFret / f.notes : 0;
  if (ratio >= 0.95) {
    stats.fullyFretted++;
    fretted.push({
      rel,
      title: meta.title || score.title,
      composer: meta.composer,
      genres: meta.genres,
      licence: meta.licence,
      notes: f.notes,
      ratio: Number(ratio.toFixed(3)),
    });
  } else if (ratio > 0) {
    stats.partlyFretted++;
  } else {
    stats.notFretted++;
  }

  if ((i + 1) % 250 === 0) process.stderr.write(`  …${i + 1}/${files.length}\n`);
}

const pct = (n) => `${((n / stats.files) * 100).toFixed(1)}%`;
const topTunings = [...tunings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

await writeFile(
  OUT,
  JSON.stringify({ stats, failures, topTunings, frettedSample: fretted.slice(0, 60) }, null, 2),
);

console.log(`\n=== alphaTab over the ${stats.files} usable scores ===\n`);
console.log(`  parsed                    ${stats.parsed} (${pct(stats.parsed)})`);
console.log(`  failed to parse           ${stats.failed}`);
console.log(`  parsed but empty          ${stats.emptyScore}`);
console.log(
  `\n  has a stringed staff      ${stats.withStringedStaff} (${pct(stats.withStringedStaff)})`,
);
console.log(`  has a tablature staff     ${stats.withTabStaff} (${pct(stats.withTabStaff)})`);
console.log(`\n  >>> FULLY FRETTED         ${stats.fullyFretted} (${pct(stats.fullyFretted)})`);
console.log(`      partly fretted        ${stats.partlyFretted}`);
console.log(`      no fret data at all   ${stats.notFretted} (${pct(stats.notFretted)})`);
console.log(`\n  standard tuning staves    ${stats.standardTuning}`);
console.log(`  other tunings             ${stats.nonStandardTuning}`);
console.log(`  with a capo               ${stats.withCapo}`);
console.log(`\n  tunings: ${topTunings.map(([t, n]) => `[${t}]=${n}`).join("  ")}`);
if (failures.length)
  console.log(
    `\n  first failures: ${failures
      .map((f) => f.error)
      .slice(0, 3)
      .join(" | ")}`,
  );
console.log(`\nwrote ${OUT}\n`);
