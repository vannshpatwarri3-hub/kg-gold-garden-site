#!/usr/bin/env node
/**
 * The two QR codes in the website footer:  npm run build-footer-qr
 *
 *   public/assets/qr/instagram.png  → the shop's Instagram (from server/config.js)
 *   public/assets/qr/website.png    → this website
 *
 * The footer only shows its QR block once these files exist, so until this ran
 * the "Follow us on Instagram" code had never appeared on the site at all.
 *
 * These are deliberately plainer than the print codes in scripts/build-qr.mjs:
 * square modules, no logo in the middle, and the full four-module quiet zone.
 * They are shown at just 116px, often photographed off another screen, and at
 * that size every bit of contrast and margin is worth more than ornament.
 *
 * Each image is read back with a real QR decoder before it is kept — a code
 * that scans to the wrong address is worse than no code at all.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { BUSINESS } from '../server/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/assets/qr');

// Same address the print codes use, so every code the shop hands out agrees.
const SITE_URL = 'https://kg-gold-garden-site.onrender.com/';

const EMERALD = '#0E3527';
const PAPER = '#FDFBF6';
const PX = 464; // shown at 116px; 4x keeps it crisp on high-density phones

const codes = [
  { file: 'instagram.png', url: BUSINESS.social.instagram.url },
  { file: 'website.png', url: SITE_URL },
];

async function decode(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

await mkdir(OUT, { recursive: true });

let failed = 0;
for (const { file, url } of codes) {
  const png = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: PX,
    color: { dark: EMERALD, light: PAPER },
  });

  const read = await decode(png);
  if (read !== url) {
    failed += 1;
    console.error(`  ✗ ${file}: scans as ${JSON.stringify(read)}, expected ${url} — not written`);
    continue;
  }

  await writeFile(path.join(OUT, file), png);
  console.log(`  ✓ ${file}  →  ${url}  (verified by decoding, ${(png.length / 1024).toFixed(1)} KB)`);
}

process.exit(failed ? 1 : 0);
