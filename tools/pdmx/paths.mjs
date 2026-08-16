/**
 * Where the PDMX working set lives.
 *
 * It is a 1.9 GB archive plus everything extracted from it, so it belongs
 * outside the repository and none of it is committed. Point `PDMX_ROOT` at
 * wherever you put it; with nothing set it resolves to a `_pdmx` folder beside
 * the repository, which is where these scripts were originally run.
 *
 *   PDMX_ROOT=/data/pdmx node tools/pdmx/analyze-metadata.mjs
 *
 * Paths come back with forward slashes on every platform, because the globs
 * here need them and because the scripts strip a known prefix off matched
 * paths to recover an archive-relative name.
 */
import { fileURLToPath } from "node:url";

const slashes = (path) => path.replaceAll("\\", "/").replace(/\/$/, "");

export const ROOT = slashes(
  process.env.PDMX_ROOT ?? fileURLToPath(new URL("../../../_pdmx", import.meta.url)),
);

/** A path inside the working set, e.g. `at("extracted", "mxl")`. */
export const at = (...parts) => [ROOT, ...parts].join("/");
