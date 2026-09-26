// Renders the Sunny app icon (the prototype's gradient sun) to PNGs in web/public/icons.
// Usage: node scripts/generate-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'web/public/icons');

/**
 * 1024×1024 square, full-bleed (iOS rounds the corners itself).
 * `scale` shrinks the sun so it stays inside the maskable safe zone.
 */
function iconSvg(scale = 1) {
  const S = 1024;
  const c = S / 2;
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = i * 36;
    // Rounded ray from r=300 to r=440, drawn pointing up then rotated.
    return `<rect x="${c - 34}" y="${c - 440}" width="68" height="140" rx="34" transform="rotate(${a} ${c} ${c})"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFE259"/>
      <stop offset="0.55" stop-color="#FF8A3D"/>
      <stop offset="1" stop-color="#FF4E8A"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <g transform="translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})">
    <circle cx="${c}" cy="${c}" r="330" fill="url(#glow)"/>
    <g fill="#FFF6C8" fill-opacity="0.95">${rays}</g>
    <circle cx="${c}" cy="${c}" r="215" fill="#FFF6C8"/>
  </g>
</svg>`;
}

const targets = [
  { file: 'apple-touch-icon-180.png', size: 180, scale: 1 },
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78 },
  { file: 'favicon-32.png', size: 32, scale: 1.1 },
];

await mkdir(out, { recursive: true });
await writeFile(join(out, 'icon.svg'), iconSvg());
for (const t of targets) {
  await sharp(Buffer.from(iconSvg(t.scale)))
    .resize(t.size, t.size)
    .flatten({ background: '#FF8A3D' })
    .png({ compressionLevel: 9 })
    .toFile(join(out, t.file));
  console.log(`wrote web/public/icons/${t.file}`);
}
