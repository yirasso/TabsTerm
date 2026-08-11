/**
 * Copies the Basic Pitch model out of node_modules and into /public, where
 * TensorFlow.js can fetch it by a URL we control.
 *
 * Serving it ourselves rather than from a CDN is the point: audio analysis
 * happens on the user's machine and must not depend on a third party being up,
 * or learn anything about what people are transcribing.
 */
import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@spotify", "basic-pitch", "model");
const to = join(root, "public", "models", "basic-pitch");

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });

console.log(`basic-pitch → public/models/basic-pitch (${(await readdir(to)).join(", ")})`);
