/**
 * Builds the shop's QR codes.
 *
 *   node scripts/build-qr.mjs
 *
 * A QR code has to survive a bad phone camera in poor light before it gets to
 * be pretty, so two rules are not negotiable here:
 *
 *   1. The code itself is one dark colour on one light one. Gold-on-black looks
 *      wonderful and fails on cheap sensors — the elegance lives in the frame
 *      around the code instead.
 *   2. Error correction stays at H (30% recoverable), which is what pays for
 *      the medallion sitting in the middle.
 *
 * Everything is drawn as SVG and rasterised, so the printed versions are sharp
 * at any size.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'qr');
const MARK = path.join(ROOT, 'public/assets/logo-mark.png');

const URL = 'https://kg-gold-garden-site.onrender.com/';

// Straight from public/css/tokens.css, so print matches screen.
const EMERALD = '#0E3527';
const GOLD_600 = '#A9791F';
const GOLD_700 = '#8A6114';
const GOLD_300 = '#E8C46E';
const PAPER = '#FDFBF6';
const TEXT = '#16211C';
const MUTED = '#5F6F65';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// The code itself
// ---------------------------------------------------------------------------

/**
 * Draws the QR as SVG at a 1-unit-per-module scale.
 *
 * The three big corner squares are the finder patterns — the things a scanner
 * looks for first. They are drawn as rounded frames rather than hard squares,
 * which reads as designed rather than generic and which every scanner still
 * recognises, because their proportions are untouched.
 */
function qrSvg({ margin = 3, dark = EMERALD, light = PAPER, logo = null } = {}) {
  const qr = QRCode.create(URL, { errorCorrectionLevel: 'H' });
  const N = qr.modules.size;
  const bits = qr.modules.data;
  const S = N + margin * 2;

  const isFinder = (x, y) =>
    (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);

  const parts = [];
  parts.push(`<rect width="${S}" height="${S}" fill="${light}"/>`);

  // Data modules, as dots with a little rounding — softer than hard squares,
  // and the gaps between them are what a scanner reads anyway.
  const dots = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!bits[y * N + x] || isFinder(x, y)) continue;
      dots.push(`M${x + margin + 0.08} ${y + margin + 0.08}h.84v.84h-.84z`);
    }
  }
  parts.push(`<path d="${dots.join('')}" fill="${dark}" rx=".2"/>`);

  // The three finder patterns.
  for (const [fx, fy] of [
    [0, 0],
    [N - 7, 0],
    [0, N - 7],
  ]) {
    const x = fx + margin;
    const y = fy + margin;
    parts.push(
      `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.7" ` +
        `fill="none" stroke="${dark}" stroke-width="1"/>`,
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".9" fill="${dark}"/>`
    );
  }

  // A clear disc for the medallion. Error correction level H covers this many
  // times over: the disc is under 5% of the code's area.
  if (logo) {
    const c = S / 2;
    const r = S * 0.118;
    parts.push(
      `<circle cx="${c}" cy="${c}" r="${r + 0.55}" fill="${light}"/>`,
      `<circle cx="${c}" cy="${c}" r="${r + 0.55}" fill="none" stroke="${GOLD_600}" stroke-width=".22" stroke-opacity=".7"/>`,
      `<image href="${logo}" x="${c - r}" y="${c - r}" width="${r * 2}" height="${r * 2}"/>`
    );
  }

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${parts.join('')}</svg>`,
    modules: N,
    units: S,
  };
}

/** Rasterises the code on its own, at `px` square. */
async function renderCode(px, opts) {
  const { svg, modules } = qrSvg(opts);
  const buf = await sharp(Buffer.from(svg), { density: 400 })
    .resize(px, px, { kernel: 'nearest' })
    .png()
    .toBuffer();
  return { buf, modules };
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

const SHOP = {
  name: 'KG GOLD GARDEN',
  tagline: 'TRUSTED FOR A BRIGHTER TOMORROW',
  call: "SCAN FOR TODAY'S GOLD RATE",
  line1: 'First Floor, Aastamangal Complex, 138–139',
  line2: 'Above HDFC Bank, near Rajasthan Hospital',
  line3: 'Shahibaug, Ahmedabad 380004',
  phone: '+91 82003 29042  ·  +91 98987 03136',
  social: 'instagram.com/kggold_ahemdabad',
  hours: 'Monday – Saturday  ·  11 AM – 8 PM',
};

/** A6 at 300 dpi — the counter card and window sticker. */
async function counterCard() {
  const W = 1240;
  const H = 1748;
  const qrPx = 760;
  const logoDataUri = `data:image/png;base64,${(await fs.readFile(MARK)).toString('base64')}`;
  const { buf: code } = await renderCode(qrPx, { logo: logoDataUri, margin: 4 });
  const markTop = (await sharp(MARK).resize(150, 150).png().toBuffer());

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD_600}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${GOLD_300}"/>
      <stop offset="100%" stop-color="${GOLD_600}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="34" y="34" width="${W - 68}" height="${H - 68}" rx="18"
        fill="none" stroke="${GOLD_600}" stroke-opacity=".55" stroke-width="2.4"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" rx="12"
        fill="none" stroke="${GOLD_600}" stroke-opacity=".28" stroke-width="1.2"/>

  <text x="${W / 2}" y="382" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="62" font-weight="700" fill="${EMERALD}"
        textLength="620" lengthAdjust="spacingAndGlyphs">${esc(SHOP.name)}</text>

  <rect x="310" y="418" width="620" height="2" fill="url(#rule)"/>

  <text x="${W / 2}" y="470" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="25" fill="${GOLD_700}"
        textLength="530" lengthAdjust="spacingAndGlyphs">${esc(SHOP.tagline)}</text>

  <text x="${W / 2}" y="1362" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="38" font-weight="600" fill="${EMERALD}"
        textLength="470" lengthAdjust="spacingAndGlyphs">${esc(SHOP.call)}</text>

  <text x="${W / 2}" y="1408" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="24" fill="${MUTED}"
        textLength="380" lengthAdjust="spacingAndGlyphs">916 jewellery · 999 gold biscuits</text>

  <rect x="380" y="1452" width="480" height="1.4" fill="url(#rule)"/>

  <text x="${W / 2}" y="1512" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="25" fill="${TEXT}" textLength="560" lengthAdjust="spacingAndGlyphs">${esc(SHOP.line1)}</text>
  <text x="${W / 2}" y="1550" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="25" fill="${TEXT}" textLength="560" lengthAdjust="spacingAndGlyphs">${esc(SHOP.line2)}</text>
  <text x="${W / 2}" y="1588" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="25" fill="${TEXT}" textLength="400" lengthAdjust="spacingAndGlyphs">${esc(SHOP.line3)}</text>

  <text x="${W / 2}" y="1638" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="26" font-weight="600" fill="${EMERALD}" textLength="530" lengthAdjust="spacingAndGlyphs">${esc(SHOP.phone)}</text>
  <text x="${W / 2}" y="1678" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="23" fill="${MUTED}" textLength="400" lengthAdjust="spacingAndGlyphs">${esc(SHOP.social)}</text>
</svg>`;

  // density 72 means one SVG unit renders as one pixel, so the canvas comes out
  // at exactly the width and height declared above and the composited pieces
  // below land where their coordinates say. Text is still drawn as vectors at
  // that resolution, so it stays crisp.
  return sharp(Buffer.from(svg), { density: 72 })
    .composite([
      { input: markTop, top: 176, left: Math.round((W - 150) / 2) },
      { input: code, top: 540, left: Math.round((W - qrPx) / 2) },
    ])
    .png()
    .toFile(path.join(OUT, 'kg-gold-garden-counter-card.png'));
}

/** 1080 square, for Instagram and WhatsApp status. */
async function square() {
  const S = 1080;
  const qrPx = 620;
  const logoDataUri = `data:image/png;base64,${(await fs.readFile(MARK)).toString('base64')}`;
  const { buf: code } = await renderCode(qrPx, { logo: logoDataUri, margin: 4 });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>
    <linearGradient id="r2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD_600}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${GOLD_300}"/>
      <stop offset="100%" stop-color="${GOLD_600}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="${PAPER}"/>
  <rect x="26" y="26" width="${S - 52}" height="${S - 52}" rx="16"
        fill="none" stroke="${GOLD_600}" stroke-opacity=".5" stroke-width="2"/>

  <text x="${S / 2}" y="128" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="52" font-weight="700" fill="${EMERALD}"
        textLength="510" lengthAdjust="spacingAndGlyphs">${esc(SHOP.name)}</text>
  <rect x="285" y="156" width="510" height="1.8" fill="url(#r2)"/>
  <text x="${S / 2}" y="200" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="21" fill="${GOLD_700}"
        textLength="440" lengthAdjust="spacingAndGlyphs">${esc(SHOP.tagline)}</text>

  <text x="${S / 2}" y="928" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="34" font-weight="600" fill="${EMERALD}"
        textLength="420" lengthAdjust="spacingAndGlyphs">${esc(SHOP.call)}</text>
  <text x="${S / 2}" y="972" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="23" fill="${MUTED}"
        textLength="330" lengthAdjust="spacingAndGlyphs">Shahibaug, Ahmedabad</text>
  <text x="${S / 2}" y="1014" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="23" fill="${MUTED}"
        textLength="360" lengthAdjust="spacingAndGlyphs">${esc(SHOP.hours)}</text>
</svg>`;

  // density 72 means one SVG unit renders as one pixel, so the canvas comes out
  // at exactly the width and height declared above and the composited pieces
  // below land where their coordinates say. Text is still drawn as vectors at
  // that resolution, so it stays crisp.
  return sharp(Buffer.from(svg), { density: 72 })
    .composite([{ input: code, top: 262, left: Math.round((S - qrPx) / 2) }])
    .png()
    .toFile(path.join(OUT, 'kg-gold-garden-square.png'));
}

/** The bare code, for anyone who wants to place it themselves. */
async function plain() {
  const logoDataUri = `data:image/png;base64,${(await fs.readFile(MARK)).toString('base64')}`;
  const { buf } = await renderCode(1400, { logo: logoDataUri, margin: 4 });
  await fs.writeFile(path.join(OUT, 'kg-gold-garden-qr-plain.png'), buf);
}

// ---------------------------------------------------------------------------

await fs.mkdir(OUT, { recursive: true });
const { modules } = qrSvg({});
await counterCard();
await square();
await plain();

console.log(`Encoded: ${URL}`);
console.log(`Grid:    ${modules} × ${modules} modules, error correction H`);
console.log('Written to qr/:');
for (const f of await fs.readdir(OUT)) {
  const { width, height } = await sharp(path.join(OUT, f)).metadata();
  const { size } = await fs.stat(path.join(OUT, f));
  console.log(`  ${f.padEnd(38)} ${width}×${height}  ${Math.round(size / 1024)} KB`);
}
