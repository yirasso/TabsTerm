"use client";

import type { ChordEvent } from "@/lib/tab/to-ascii";
import type { MonoAudio } from "./decode";

/**
 * Chord recognition with essentia.js, running entirely in the browser.
 *
 * This is via 2: the user brings an audio file they already have. A full-band
 * mix cannot be separated into individual notes, so what comes out is a chord
 * sheet — a different artefact from tablature, and the UI says so.
 *
 * The pipeline is essentia's documented one: frame the signal, window it, take
 * the spectrum, find its peaks, fold those into a harmonic pitch class profile,
 * and read chords off the sequence of profiles.
 */

const FRAME_SIZE = 4096;
const HOP_SIZE = 2048;
/** Where scripts/copy-models.mjs puts the WASM binary. */
const WASM_BASE = "/models/essentia";

/** Essentia's vectors are WASM-owned and must be freed by hand. */
type Freeable = { delete?: () => void };
const free = (...items: (Freeable | null | undefined)[]) => {
  for (const item of items) item?.delete?.();
};

/**
 * The WASM build is a UMD wrapper around an Emscripten module, and which shape
 * survives the bundler's interop varies: a named export, a default export, a
 * factory returning a promise, or an object carrying a `ready` promise. The
 * only thing that identifies the real module is that it carries `EssentiaJS`,
 * which is what the core constructor reaches for — so look for that rather
 * than guessing at the packaging.
 */
async function resolveWasm(imported: unknown): Promise<unknown> {
  // Emscripten looks for its .wasm next to the script that loaded it, which
  // under Turbopack is /_next/static/chunks — where the binary is not. Without
  // this the module never finishes initialising and the analysis hangs with no
  // error at all.
  const config = {
    locateFile: (path: string) => `${WASM_BASE}/${path}`,
  };

  const seen = new Set<unknown>();
  const queue: unknown[] = [imported];

  while (queue.length > 0) {
    const candidate = await queue.shift();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    if (typeof candidate === "object" && "EssentiaJS" in candidate) return candidate;

    if (typeof candidate === "function") {
      try {
        queue.push((candidate as (options?: unknown) => unknown)(config));
      } catch {
        // Not a factory after all.
      }
      continue;
    }

    if (typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      for (const key of ["default", "EssentiaWASM", "ready", "Module"]) {
        if (key in record) queue.push(record[key]);
      }
    }
  }

  throw new Error("essentia wasm module did not expose EssentiaJS");
}

/** Chord names arrive as a WASM vector in some builds, a plain array in others. */
function readStrings(value: { size(): number; get(i: number): string } | string[]): string[] {
  if (Array.isArray(value)) return value;
  return Array.from({ length: value.size() }, (_, i) => value.get(i));
}

export type ChordProgress = (percent: number) => void;

export async function detectChords(
  audio: MonoAudio,
  onProgress: ChordProgress = () => {},
): Promise<ChordEvent[]> {
  const wasmModule = await import("essentia.js/dist/essentia-wasm.web.js");
  const { default: Essentia } = await import("essentia.js/dist/essentia.js-core.es.js");

  const essentia = new Essentia(await resolveWasm(wasmModule));

  const framesVector = essentia.FrameGenerator(audio.samples, FRAME_SIZE, HOP_SIZE);
  const total = framesVector.size();

  // ChordsDetection wants a vector OF vectors, one harmonic pitch class profile
  // per frame. There is no helper for building a 2D vector, so reach for the
  // Embind type on the module and keep each profile as a WASM vector rather
  // than round-tripping through JS arrays.
  const profiles = new essentia.module.VectorVectorFloat();
  const held: { delete(): void }[] = [];

  try {
    for (let i = 0; i < total; i++) {
      const frame = framesVector.get(i);
      const windowed = essentia.Windowing(frame, true, FRAME_SIZE, "hann");
      const spectrum = essentia.Spectrum(windowed.frame, FRAME_SIZE);
      const peaks = essentia.SpectralPeaks(spectrum.spectrum);
      const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes);

      profiles.push_back(hpcp.hpcp);
      held.push(hpcp.hpcp);
      free(windowed.frame, spectrum.spectrum, peaks.frequencies, peaks.magnitudes);

      if (i % 25 === 0) onProgress(Math.round((i / total) * 100));
    }

    if (profiles.size() === 0) return [];

    const detected = essentia.ChordsDetection(profiles, HOP_SIZE, audio.sampleRate, 2);
    const names = readStrings(detected.chords);
    free(detected.strength);
    if (!Array.isArray(detected.chords)) detected.chords.delete();

    const secondsPerFrame = HOP_SIZE / audio.sampleRate;
    onProgress(100);

    return names.map((name, i) => ({ name, time: i * secondsPerFrame }));
  } finally {
    for (const vector of held) vector.delete();
    free(profiles, framesVector);
  }
}
