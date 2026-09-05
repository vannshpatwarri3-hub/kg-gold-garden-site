#!/usr/bin/env node
/**
 * Turn your photographs into web-ready product images.
 *
 *   npm run add-photos
 *
 * Drop any photos into  public/assets/products/incoming/  at whatever size your
 * camera or phone produced — no cropping, no resizing, no renaming needed. This
 * straightens them using the EXIF orientation, crops to the 4:3 the cards use,
 * writes an optimised WebP plus a JPEG for older browsers, and offers to add
 * each one to data/products.json ready for you to fill in the weight and karat.
 *
 * Originals are moved to incoming/processed/ so nothing is ever destroyed.
 */
import { readdir, mkdir, rename, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { question, stop } from './prompt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'assets', 'products');
const INCOMING = path.join(PRODUCTS_DIR, 'incoming');
const PROCESSED = path.join(INCOMING, 'processed');
const DATA_FILE = path.join(ROOT, 'data', 'products.json');

// The card is 4:3. 1200x900 stays sharp on a retina screen without being heavy.
const WIDTH = 1200;
const HEIGHT = 900;

const rule = (c = '─') => c.repeat(70);
const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.heif', '.avif']);

const slug = (name) =>
  path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'piece';

/** "kada-plain-22k" -> "Kada Plain 22k" — a starting point, not the final name. */
const titleFromSlug = (s) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

await mkdir(INCOMING, { recursive: true });
await mkdir(PROCESSED, { recursive: true });

let entries = [];
try {
  entries = await readdir(INCOMING, { withFileTypes: true });
} catch {
  /* handled below */
}

const photos = entries
  .filter((e) => e.isFile() && SUPPORTED.has(path.extname(e.name).toLowerCase()))
  .map((e) => e.name)
  .sort();

if (!photos.length) {
  console.log(`\n${rule('═')}`);
  console.log('  No photos found.');
  console.log(rule('═'));
  console.log(`\n  Put your pictures in this folder, then run this again:\n`);
  console.log(`    ${INCOMING}\n`);
  console.log('  Any size, straight off the phone or camera. Accepted formats:');
  console.log('  JPG, PNG, HEIC (iPhone), WebP, TIFF, AVIF.\n');
  process.exit(0);
}

console.log(`\n${rule('═')}`);
console.log(`  Preparing ${photos.length} photo${photos.length === 1 ? '' : 's'}`);
console.log(rule('═') + '\n');

const made = [];

for (const file of photos) {
  const src = path.join(INCOMING, file);
  const name = slug(file);
  process.stdout.write(`  ${file} … `);

  try {
    const image = sharp(src, { failOn: 'none' }).rotate(); // rotate() applies EXIF orientation
    const meta = await image.metadata();

    const pipeline = image.resize(WIDTH, HEIGHT, {
      fit: 'cover',        // fill the 4:3 frame
      position: 'attention', // keep the piece itself, not a corner of the cloth
      withoutEnlargement: false,
    });

    await pipeline.clone().webp({ quality: 82 }).toFile(path.join(PRODUCTS_DIR, `${name}.webp`));
    await pipeline.clone().jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(PRODUCTS_DIR, `${name}.jpg`));

    const { size } = await stat(path.join(PRODUCTS_DIR, `${name}.webp`));
    await rename(src, path.join(PROCESSED, file));

    made.push({ name, file });
    console.log(
      `${meta.width}×${meta.height} → ${WIDTH}×${HEIGHT}  (${Math.round(size / 1024)} KB)`
    );
  } catch (err) {
    console.log(`skipped — ${err.message}`);
  }
}

if (!made.length) {
  console.log('\n  Nothing was produced.\n');
  process.exit(1);
}

console.log(`\n${rule()}`);
console.log(`  ${made.length} image${made.length === 1 ? '' : 's'} written to public/assets/products/`);
console.log(`  Originals moved to incoming/processed/ — nothing was deleted.`);
console.log(rule());

// --- offer to register them --------------------------------------------------

const answer = (await question('\n  Add these to your product list now? [Y/n] ')).toLowerCase();
stop();

if (answer && !answer.startsWith('y')) {
  console.log('\n  Left alone. The image paths, for data/products.json:\n');
  made.forEach((m) => console.log(`    /assets/products/${m.name}.webp`));
  console.log('');
  process.exit(0);
}

let file;
try {
  file = JSON.parse(await readFile(DATA_FILE, 'utf8'));
} catch {
  file = { status: 'sample', items: [] };
}

const existing = new Set((file.items ?? []).map((i) => i.image));
let added = 0;

for (const m of made) {
  const image = `/assets/products/${m.name}.webp`;
  if (existing.has(image)) continue;

  file.items.push({
    id: m.name,
    name: titleFromSlug(m.name),
    category: 'ring',   // ← edit
    karat: '22K',       // ← edit
    finish: 'yellow',   // ← edit
    grams: 5,           // ← edit
    makingPct: 12,      // ← edit
    image,
    blurb: '',          // ← a sentence about the piece
  });
  added += 1;
}

await writeFile(DATA_FILE, JSON.stringify(file, null, 2), 'utf8');

console.log(`\n${rule('═')}`);
console.log(`  Added ${added} piece${added === 1 ? '' : 's'} to data/products.json`);
console.log(rule('═'));
console.log(`
  Now open that file and correct these for each piece:

    name       what you call it
    category   ring | bangle | chain | earring | coin
    karat      18K | 22K | 24K
    finish     yellow | rose        (rose is not possible in 24K)
    grams      the actual weight
    makingPct  your making charge, as a percentage
    blurb      one honest sentence about the piece

  The price is worked out from those and the day's rate — you never type a
  price. Once the list is genuinely yours, set  "status": "live"  at the top of
  the file to remove the "sample pieces" banner from the website.
`);
