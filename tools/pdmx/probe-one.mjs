/** Smoke test: can alphaTab read a PDMX .mxl in Node, and what shape comes back? */
import { globSync, readFileSync } from "node:fs";
import * as alphaTab from "@coderline/alphatab";

const files = globSync("C:/Dev/_pdmx/extracted/mxl/**/*.mxl");
console.log(`found ${files.length} files, probing the first`);

const bytes = new Uint8Array(readFileSync(files[0]));
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);

console.log(`title:  ${score.title}`);
console.log(`tracks: ${score.tracks.length}`);
console.log(`bars:   ${score.masterBars.length}`);

for (const track of score.tracks) {
  for (const staff of track.staves) {
    console.log(
      `  track "${track.name}" staff: isStringed=${staff.isStringed} ` +
        `tuning=[${staff.tuning}] showTablature=${staff.showTablature} ` +
        `showStandardNotation=${staff.showStandardNotation} capo=${staff.capo}`,
    );
  }
}

// First few notes: do they carry string/fret, or only pitch?
const staff = score.tracks[0].staves[0];
let shown = 0;
outer: for (const bar of staff.bars) {
  for (const voice of bar.voices) {
    for (const beat of voice.beats) {
      for (const note of beat.notes) {
        console.log(
          `  note: string=${note.string} fret=${note.fret} octave=${note.octave} tone=${note.tone} isStringed=${note.isStringed}`,
        );
        if (++shown >= 6) break outer;
      }
    }
  }
}
