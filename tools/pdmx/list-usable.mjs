/**
 * Etapa 0, phase B step 1: write the .mxl paths of the usable set, for tar to
 * extract. "Usable" is the same definition analyze-metadata.mjs reports on.
 *
 *   node tools/pdmx/list-usable.mjs
 */
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { parse } from "csv-parse";
import { GUITAR_PROGRAMS, parseTracks } from "./gm.mjs";

const CSV = process.argv[2] ?? "C:/Dev/_pdmx/PDMX.csv";
const OUT_LIST = "C:/Dev/_pdmx/usable-mxl.txt";
const OUT_INDEX = "C:/Dev/_pdmx/usable-index.json";

const isTrue = (v) => v === "True" || v === "true";

const paths = [];
const index = {};

const parser = createReadStream(CSV).pipe(
  parse({ columns: true, skip_empty_lines: true, relax_quotes: true }),
);

for await (const row of parser) {
  if (!isTrue(row["subset:all_valid"])) continue;
  if (!isTrue(row["subset:no_license_conflict"])) continue;
  if (!isTrue(row.is_best_unique_arrangement)) continue;

  const tracks = parseTracks(row.tracks);
  const guitars = tracks.filter((p) => GUITAR_PROGRAMS.has(p));
  if (tracks.length === 0 || guitars.length * 2 < tracks.length) continue;
  if (!row.mxl || row.mxl === "NA") continue;

  // tar wants archive-relative paths; the CSV stores them as "./mxl/…".
  const rel = row.mxl.replace(/^\.\//, "");
  paths.push(rel);
  index[rel] = {
    title: (row.title ?? "").trim(),
    songName: (row.song_name ?? "").trim(),
    composer: (row.composer_name ?? "").trim(),
    artist: (row.artist_name ?? "").trim(),
    genres: row.genres ?? "",
    licence: row.license ?? "",
    complexity: row.complexity ?? "",
    rating: row.rating ?? "",
    nTracks: Number(row.n_tracks ?? 0),
    tracks: row.tracks ?? "",
    bars: Number(row["song_length.bars"] ?? 0),
    notes: Number(row.n_notes ?? 0),
  };
}

await writeFile(OUT_LIST, `${paths.join("\n")}\n`);
await writeFile(OUT_INDEX, JSON.stringify(index, null, 2));
console.log(`${paths.length} usable .mxl paths -> ${OUT_LIST}`);
