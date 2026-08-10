/**
 * General MIDI program numbers. PDMX's `tracks` column is a hyphen-separated
 * list of these, not instrument names — `24-24-33` is two nylon guitars and an
 * electric bass.
 */
export const GUITAR_PROGRAMS = new Set([
  24, // Acoustic Guitar (nylon)
  25, // Acoustic Guitar (steel)
  26, // Electric Guitar (jazz)
  27, // Electric Guitar (clean)
  28, // Electric Guitar (muted)
  29, // Overdriven Guitar
  30, // Distortion Guitar
  31, // Guitar Harmonics
]);

export const BASS_PROGRAMS = new Set([32, 33, 34, 35, 36, 37, 38, 39]);

export const PROGRAM_NAMES = {
  24: "acoustic nylon",
  25: "acoustic steel",
  26: "electric jazz",
  27: "electric clean",
  28: "electric muted",
  29: "overdriven",
  30: "distortion",
  31: "harmonics",
};

/** `"24-0-33"` → `[24, 0, 33]`. Missing or malformed values yield []. */
export function parseTracks(raw) {
  if (!raw || raw === "NA") return [];
  const out = [];
  for (const part of raw.split("-")) {
    const n = Number.parseInt(part, 10);
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}
