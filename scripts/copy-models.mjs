/**
 * Copies the models and WASM binaries out of node_modules and into /public,
 * where the browser can fetch them by a URL we control.
 *
 * Serving them ourselves rather than from a CDN is the point: audio analysis
 * happens on the user's machine and must not depend on a third party being up,
 * or learn anything about what people are transcribing.
 *
 * Emscripten resolves its .wasm relative to the script that loaded it, which
 * under Turbopack means /_next/static/chunks — where the binary is not. Hence
 * copying it somewhere stable and pointing `locateFile` at it.
 */
import { copyFile, cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "node_modules");
const publicDir = join(root, "public", "models");

const basicPitchTo = join(publicDir, "basic-pitch");
await mkdir(basicPitchTo, { recursive: true });
await cp(join(modules, "@spotify", "basic-pitch", "model"), basicPitchTo, { recursive: true });
console.log(
  `basic-pitch → public/models/basic-pitch (${(await readdir(basicPitchTo)).join(", ")})`,
);

const essentiaTo = join(publicDir, "essentia");
await mkdir(essentiaTo, { recursive: true });
await copyFile(
  join(modules, "essentia.js", "dist", "essentia-wasm.web.wasm"),
  join(essentiaTo, "essentia-wasm.web.wasm"),
);
console.log(`essentia → public/models/essentia (${(await readdir(essentiaTo)).join(", ")})`);
