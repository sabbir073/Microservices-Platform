// Generate PWA PNG icons from public/icon.svg using sharp.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const svg = await readFile(join(pub, "icon.svg"));

const BG = { r: 10, g: 10, b: 15, alpha: 1 }; // #0a0a0f

async function render(size, out, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(svg).resize(inner, inner).png().toBuffer();
  const offset = Math.round((size - inner) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(join(pub, out));
  console.log("wrote", out);
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "icon-512-maskable.png", { padding: 0.1 });
await render(180, "apple-touch-icon.png");
console.log("done");
