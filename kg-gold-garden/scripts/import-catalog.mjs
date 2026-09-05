#!/usr/bin/env node
/**
 * One-off import of the showroom's catalogue folder.
 *
 *   node scripts/import-catalog.mjs "C:/path/to/K.G Gold Garden"
 *
 * Each source file is identified below by the timestamp in its name. Weight and
 * karat are recorded ONLY for the bars, where both are stamped on the metal in
 * the picture itself. Nothing is recorded for the jewellery, because guessing a
 * weight would invent a price — those pieces show "Price on request" instead.
 */
import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'products');
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const SRC = process.argv[2];

if (!SRC) {
  console.error('\n  Usage: node scripts/import-catalog.mjs "<folder of images>"\n');
  process.exit(1);
}

const WIDTH = 1200;
const HEIGHT = 900;

/** key = the HH_MM_SS in the filename. */
const CATALOG = {
  // --- bars: weight and purity are stamped on the metal in the photograph ---
  '11_47_22': { id: 'bar-1g', name: '1 g Gold Bar', category: 'coin', karat: '24K', finish: 'yellow', grams: 1, makingPct: 2,
    blurb: 'One gram, 999 fine. The smallest way to start, and a common gift at Dhanteras.' },
  '11_47_31': { id: 'bar-2g', name: '2 g Gold Bar', category: 'coin', karat: '24K', finish: 'yellow', grams: 2, makingPct: 2,
    blurb: 'Two grams, 999 fine, sealed in its assay card.' },
  '11_47_38': { id: 'bar-5g', name: '5 g Gold Bar', category: 'coin', karat: '24K', finish: 'yellow', grams: 5, makingPct: 2,
    blurb: 'Five grams, 999 fine. A practical size to buy a little at a time.' },
  '11_43_09': { id: 'biscuit-10g-a', name: '10 g Gold Biscuit', category: 'coin', karat: '24K', finish: 'yellow', grams: 10, makingPct: 2,
    blurb: 'Ten grams, 999 fine. The size most people buy as savings.' },
  '11_46_49': { id: 'biscuit-10g-b', name: '10 g Gold Biscuit', category: 'coin', karat: '24K', finish: 'yellow', grams: 10, makingPct: 2,
    blurb: 'Ten grams, 999 fine, in an alternate mint stamp.' },
  '11_47_08': { id: 'bar-50g', name: '50 g Gold Bar', category: 'coin', karat: '24K', finish: 'yellow', grams: 50, makingPct: 2,
    blurb: 'Fifty grams, 999 fine. Bought outright rather than built up.' },

  // --- necklace sets -------------------------------------------------------
  '11_43_36': { id: 'set-emerald-drop', name: 'Emerald Drop Bridal Set', category: 'necklace-set', finish: 'yellow',
    blurb: 'Layered pearl and green bead strings gathered into a kundan pendant, with matching tops.' },
  '11_44_14': { id: 'set-rose-kundan', name: 'Rose Kundan Choker Set', category: 'necklace-set', finish: 'yellow',
    blurb: 'A close-fitting kundan choker with pink stones and a pearl fringe, with jhumka drops.' },
  '11_53_29': { id: 'set-mesh-solitaire', name: 'Mesh Collar Set', category: 'necklace-set', finish: 'yellow',
    blurb: 'A woven mesh collar holding rose-cut stones, finished with a teardrop and matching earrings.' },

  // --- necklaces & pendants ------------------------------------------------
  '11_49_57': { id: 'pendant-octagon', name: 'Octagon Pendant Chain', category: 'necklace', finish: 'yellow',
    blurb: 'A single faceted octagonal stone held in claws on a fine cable chain.' },
  '11_50_28': { id: 'pendant-mop', name: 'Mother-of-Pearl Pendant', category: 'necklace', finish: 'yellow',
    blurb: 'A round mother-of-pearl disc in a plain bezel, on a box chain. Quiet enough for every day.' },

  // --- chains --------------------------------------------------------------
  '11_49_26': { id: 'chain-two-tone', name: 'Two-Tone Tassel Chain', category: 'chain', finish: 'yellow',
    blurb: 'A long chain of linked circles and beads in two tones, dropping into fine tassels.' },
  '11_49_47': { id: 'chain-bead-mala', name: 'Beaded Stone Mala', category: 'chain', finish: 'yellow',
    blurb: 'Gold beads alternating with cut green stones, thickening towards the front.' },
  '11_53_22': { id: 'chain-stone-line', name: 'Stone Line Chain', category: 'chain', finish: 'yellow',
    blurb: 'A continuous double line of small white stones, worn on its own.' },

  // --- rings ---------------------------------------------------------------
  '11_44_21': { id: 'ring-sapphire-bloom', name: 'Sapphire Bloom Ring', category: 'ring', finish: 'rose',
    blurb: 'A flower of white stones set beside a single blue stone, on a split shank.' },
  '11_44_31': { id: 'ring-jade-antique', name: 'Jade Antique Ring', category: 'ring', finish: 'yellow',
    blurb: 'A green cabochon centre framed in beadwork, rubies and white stones.' },
  '11_44_41': { id: 'ring-emerald-knot', name: 'Emerald Knot Ring', category: 'ring', finish: 'yellow',
    blurb: 'A rectangular green stone held inside crossing bands of small white stones.' },
  '11_47_49': { id: 'ring-marquise-spiral', name: 'Marquise Spiral Ring', category: 'ring', finish: 'rose',
    blurb: 'Marquise-cut stones turning in a spiral inside three fine outer rows.' },
  '11_48_54': { id: 'ring-pearl-sun', name: 'Pearl Sun Ring', category: 'ring', finish: 'yellow',
    blurb: 'A ring of pearls around a ruby centre, inside a fluted gold border.' },
  '11_49_05': { id: 'ring-antique-rasrawa', name: 'Antique Pearl Ring', category: 'ring', finish: 'yellow',
    blurb: 'Traditional antique work — rubies, pearls and a green stone across a domed face.' },
  '11_49_15': { id: 'ring-ruby-cluster', name: 'Ruby Cluster Ring', category: 'ring', finish: 'yellow',
    blurb: 'Rose-cut white stones and rubies clustered over a raised dome.' },

  // --- earrings ------------------------------------------------------------
  '11_48_41': { id: 'ear-horseshoe', name: 'Horseshoe Stud Earrings', category: 'earring', finish: 'yellow',
    blurb: 'An open horseshoe outlined in small stones, edged with larger rose cuts.' },
  '11_49_39': { id: 'ear-teardrop', name: 'Teardrop Drop Earrings', category: 'earring', finish: 'yellow',
    blurb: 'A pavé top with an open teardrop below, split by a line of white stones.' },

  // --- kada & bangles ------------------------------------------------------
  '11_50_12': { id: 'bracelet-charm', name: 'Enamel Charm Bracelet', category: 'bangle', finish: 'yellow',
    blurb: 'A fine chain hung with small enamelled charms in blue and white.' },
  '11_50_20': { id: 'bangle-crown', name: 'Crown Stone Bangle', category: 'bangle', finish: 'rose',
    blurb: 'A slim bangle with a raised row of claw-set stones above a pavé band.' },
  '11_52_23': { id: 'bangle-jade-lotus', name: 'Jade Lotus Kada', category: 'bangle', finish: 'yellow',
    blurb: 'Two green cabochons capped with lotus work, joined by a pierced gold band.' },
  '11_53_02': { id: 'bangle-baguette', name: 'Baguette Line Bangle', category: 'bangle', finish: 'rose',
    blurb: 'A full circle of baguette-cut stones in a clean claw setting, with a box clasp.' },

  // --- half-kada bands -----------------------------------------------------
  '11_52_14': { id: 'band-olive', name: 'Olive Band Bracelet', category: 'band', finish: 'rose',
    blurb: 'A soft olive band with a stone-set link at the centre and an adjustable fitting.' },
  '11_54_14': { id: 'band-tan-disc', name: 'Tan Band Bracelet', category: 'band', finish: 'yellow',
    blurb: 'A tan band with a round stone-set disc and two small stone bars either side.' },
};

const files = await readdir(SRC);
await mkdir(OUT_DIR, { recursive: true });

const items = [];
const unmatched = [];

for (const file of files.sort()) {
  if (!/\.(png|jpe?g|webp|heic|tiff?)$/i.test(file)) continue;

  const key = Object.keys(CATALOG).find((k) => file.includes(k));
  if (!key) {
    unmatched.push(file);
    continue;
  }

  const spec = CATALOG[key];
  process.stdout.write(`  ${spec.name.padEnd(28)} `);

  const image = sharp(path.join(SRC, file), { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  const pipeline = image.resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' });

  await pipeline.clone().webp({ quality: 84 }).toFile(path.join(OUT_DIR, `${spec.id}.webp`));
  await pipeline.clone().jpeg({ quality: 85, mozjpeg: true }).toFile(path.join(OUT_DIR, `${spec.id}.jpg`));

  const { id, ...rest } = spec;
  items.push({ id, ...rest, image: `/assets/products/${id}.webp` });
  console.log(`${meta.width}×${meta.height} → ${WIDTH}×${HEIGHT}`);
}

// Keep COLLECTIONS order stable in the file itself for easier hand-editing.
const ORDER = ['necklace-set', 'necklace', 'chain', 'ring', 'earring', 'bangle', 'band', 'coin'];
items.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));

let file;
try {
  file = JSON.parse(await readFile(DATA_FILE, 'utf8'));
} catch {
  file = {};
}

await writeFile(
  DATA_FILE,
  JSON.stringify(
    {
      status: file.status ?? 'sample',
      note: 'Weight and karat are recorded only where they are stamped on the piece itself. Everything else shows "Price on request" and sends the customer to WhatsApp — add "grams" and "karat" to a piece and it starts pricing itself from the daily rate.',
      items,
    },
    null,
    2
  ),
  'utf8'
);

console.log(`\n  ${items.length} pieces written to data/products.json`);
if (unmatched.length) console.log(`  ${unmatched.length} file(s) not in the catalog map: ${unmatched.join(', ')}`);
