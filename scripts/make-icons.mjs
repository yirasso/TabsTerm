/**
 * Turns the source logo into the two icons Next serves from `src/app/`.
 *
 * Kept as a script rather than done once by hand so the icons can be rebuilt
 * from the original when it changes, at the same sizes and with the same
 * settings. Run it with the path to the full-size logo:
 *
 *   node scripts/make-icons.mjs path/to/logo.jpeg
 *
 * The palette matters more than it looks. The logo is two colours and a glow,
 * but it carries a scanline texture that defeats ordinary PNG compression —
 * straight through, a 512px icon lands around 270KB, which is an absurd weight
 * for something a browser draws at 16 pixels. Quantised it costs a fraction of
 * that and is indistinguishable at every size it is actually shown.
 */

import { statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/make-icons.mjs <logo>");
  process.exit(1);
}

const root = path.join(import.meta.dirname, "..", "src", "app");

/** 512 for the tab and the PWA manifest; 180 is what iOS asks for. */
const SIZES = [
  { file: "icon.png", size: 512 },
  { file: "apple-icon.png", size: 180 },
];

const png = (size) =>
  sharp(source)
    .resize(size, size, { fit: "cover" })
    .png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 })
    .toBuffer();

for (const { file, size } of SIZES) {
  const out = path.join(root, file);
  writeFileSync(out, await png(size));
  console.log(`${file} — ${size}px, ${(statSync(out).size / 1024).toFixed(1)} KB`);
}

/**
 * `favicon.ico` as well, because plenty of clients ask for it by that exact
 * path without ever reading the document's `<link>` tags — and the one Next's
 * scaffold shipped was the Next logo, sitting in browser tabs.
 *
 * An .ico is a tiny header around one or more images, and since Vista those
 * images may themselves be PNGs. So this is a 22-byte wrapper rather than a
 * bitmap encoder, which is why it needs no dependency.
 */
const ICO_SIZE = 256;

/**
 * Full RGBA here, not the quantised palette the other two use. An ICO's PNG
 * payload has to be 32-bit — Next decodes this file during `next build` to
 * read its size, and an indexed PNG fails the build with "The PNG is not in
 * RGBA format". It costs a few tens of kilobytes on a file most visitors
 * never fetch, which is the right side of that trade.
 */
// No `effort: 10` here, and that is the whole trick: at maximum effort sharp
// optimises away an alpha channel that is entirely opaque, and the file comes
// back as three-channel RGB — which fails the build exactly like an indexed
// one does. `ensureAlpha()` cannot save it, because the stripping happens
// after. So the two other icons get the effort and this one does not.
const image = await sharp(source)
  .resize(ICO_SIZE, ICO_SIZE, { fit: "cover" })
  .ensureAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(1, 4); // one image inside

const entry = Buffer.alloc(16);
entry.writeUInt8(ICO_SIZE === 256 ? 0 : ICO_SIZE, 0); // 0 means 256
entry.writeUInt8(ICO_SIZE === 256 ? 0 : ICO_SIZE, 1);
entry.writeUInt8(0, 2); // palette size, 0 for a PNG payload
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(image.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12); // where the image starts

const ico = path.join(root, "favicon.ico");
writeFileSync(ico, Buffer.concat([header, entry, image]));
console.log(`favicon.ico — ${ICO_SIZE}px, ${(statSync(ico).size / 1024).toFixed(1)} KB`);
