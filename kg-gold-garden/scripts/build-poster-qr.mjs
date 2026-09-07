/**
 * Puts the website QR onto the shop's own poster.
 *
 *   node scripts/build-poster-qr.mjs
 *
 * Two placements, because the right one is a matter of taste:
 *
 *   inset  - the code sits on the velvet at the foot of the picture, on an
 *            ivory card with a gold edge, so it reads as an object lying in
 *            the scene rather than a sticker over it. The calm patch it
 *            occupies was measured, not eyeballed.
 *   band   - the picture is left completely untouched and the code sits in a
 *            maroon band beneath it. Safest to scan, nothing obscured.
 *
 * Both carry the Instagram handle and the web address underneath.
 *
 * The maroon and gold below were sampled from the poster itself, so anything
 * added shares its colour rather than approximating it. Output is PNG: the
 * source is PNG and the brief was explicitly not to soften it.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'C:/Users/Vansh Patwari/Downloads/kg qr';
const MARK = path.join(ROOT, 'public/assets/logo-mark.png');
const OUT = path.join(ROOT, 'qr');

const URL = 'https://kg-gold-garden-site.onrender.com/';
const SITE = 'kg-gold-garden-site.onrender.com';
const HANDLE = '@kggold_ahemdabad';

// Sampled from the poster.
const MAROON_DEEP = '#25060A';
const MAROON = '#3A0C0E';
const GOLD_BRIGHT = '#EED090';
const GOLD = '#C9A24E';
const GOLD_DEEP = '#8A6A2A';
const IVORY = '#FAF4E6';
const MODULE = '#25060A'; // near-black maroon: reads as part of the palette, scans as black

// ---------------------------------------------------------------------------

/** The code, on ivory, with the shop's medallion in the middle. */
async function qrPanel(px) {
  const qr = QRCode.create(URL, { errorCorrectionLevel: 'H' });
  const N = qr.modules.size;
  const bits = qr.modules.data;
  const M = 4;
  const S = N + M * 2;
  const isFinder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);

  let dots = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (bits[y * N + x] && !isFinder(x, y)) dots += `M${x + M + 0.08} ${y + M + 0.08}h.84v.84h-.84z`;
    }
  }
  let finders = '';
  for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
    const x = fx + M;
    const y = fy + M;
    finders +=
      `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.7" fill="none" stroke="${MODULE}" stroke-width="1"/>` +
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".9" fill="${MODULE}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${px}" height="${px}">
    <rect width="${S}" height="${S}" fill="${IVORY}"/>
    <path d="${dots}" fill="${MODULE}"/>${finders}
    <circle cx="${S / 2}" cy="${S / 2}" r="${S * 0.125}" fill="${IVORY}"/>
    <circle cx="${S / 2}" cy="${S / 2}" r="${S * 0.125}" fill="none" stroke="${GOLD_DEEP}" stroke-width=".22" stroke-opacity=".75"/>
  </svg>`;

  const code = await sharp(Buffer.from(svg), { density: 400 })
    .resize(px, px, { kernel: 'nearest' })
    .png()
    .toBuffer();

  const markPx = Math.round(px * 0.2);
  return sharp(code)
    .composite([
      {
        input: await sharp(MARK).resize(markPx, markPx).png().toBuffer(),
        top: Math.round((px - markPx) / 2),
        left: Math.round((px - markPx) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/** The ivory card the code sits on: gold double rule, soft shadow beneath. */
function cardSvg(size, pad) {
  const S = size + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S + 10}">
    <defs>
      <filter id="sh" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="9" stdDeviation="13" flood-color="#120203" flood-opacity=".72"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="${S - 4}" height="${S - 4}" rx="14" fill="${IVORY}" filter="url(#sh)"/>
    <rect x="7.5" y="7.5" width="${S - 15}" height="${S - 15}" rx="10" fill="none" stroke="${GOLD_DEEP}" stroke-width="2.5" stroke-opacity=".85"/>
    <rect x="13.5" y="13.5" width="${S - 27}" height="${S - 27}" rx="6" fill="none" stroke="${GOLD}" stroke-width="1" stroke-opacity=".55"/>
  </svg>`;
}

const igGlyph = (x, y, s, fill) =>
  `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${fill}" stroke-width="2">
     <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.6"/>
     <circle cx="12" cy="12" r="4.6"/>
     <circle cx="17.6" cy="6.4" r="1.3" fill="${fill}" stroke="none"/>
   </g>`;

/** The strip of wording that goes under the picture in both versions. */
function captionSvg(W, H, { withQrColumn }) {
  const left = withQrColumn ? 404 : 60;
  const centre = withQrColumn ? left : W / 2;
  const anchor = withQrColumn ? 'start' : 'middle';
  const base = withQrColumn ? 92 : 74;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${MAROON}"/>
      <stop offset="100%" stop-color="${MAROON_DEEP}"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD_DEEP}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${GOLD_BRIGHT}"/>
      <stop offset="100%" stop-color="${GOLD_DEEP}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="2.5" fill="url(#rule)"/>

  <!-- Sized, not constrained: the renderer here ignores textLength, so the
       column layout gets a smaller face to keep clear of the right margin. -->
  <text x="${centre}" y="${base}" text-anchor="${anchor}" font-family="Georgia, 'Times New Roman', serif"
        font-size="${withQrColumn ? 27 : 31}" font-weight="700" fill="${GOLD_BRIGHT}">SCAN FOR TODAY'S GOLD RATE</text>

  <text x="${centre}" y="${base + 44}" text-anchor="${anchor}" font-family="Segoe UI, Arial, sans-serif"
        font-size="21" fill="${IVORY}" fill-opacity=".93"
        textLength="${withQrColumn ? 386 : 402}" lengthAdjust="spacingAndGlyphs">${SITE}</text>

  <rect x="${withQrColumn ? left : (W - 300) / 2}" y="${base + 74}" width="300" height="1.4" fill="url(#rule)"/>

  ${igGlyph(withQrColumn ? left : W / 2 - 148, base + 100, 30, GOLD_BRIGHT)}
  <text x="${withQrColumn ? left + 44 : W / 2 - 108}" y="${base + 124}" text-anchor="start"
        font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="600" fill="${IVORY}"
        textLength="256" lengthAdjust="spacingAndGlyphs">${HANDLE}</text>

  <text x="${centre}" y="${base + 172}" text-anchor="${anchor}" font-family="Segoe UI, Arial, sans-serif"
        font-size="19" fill="${GOLD}" fill-opacity=".82"
        textLength="${withQrColumn ? 404 : 424}" lengthAdjust="spacingAndGlyphs">Shahibaug, Ahmedabad · Mon–Sat, 11 AM – 8 PM</text>
</svg>`;
}

// ---------------------------------------------------------------------------

const meta = await sharp(SRC).metadata();
const W = meta.width;
const H = meta.height;

// --- version 1: the code inset on the velvet, wording in a slim band ---------
{
  const QR = 354;
  const PAD = 19;
  const BAND = 296; // tall enough to clear the last line's descenders
  // Re-measured for the larger card: this is the calmest 392px patch in the
  // lower half of the picture, clear of the necklace, the earrings, the lamp
  // and the brass at both corners. Lifted 10px off the measured y so the
  // shadow keeps a margin above the band.
  const X = 244;
  const Y = 1236;

  const card = await sharp(Buffer.from(cardSvg(QR, PAD))).png().toBuffer();
  const code = await qrPanel(QR);

  await sharp({
    create: { width: W, height: H + BAND, channels: 3, background: MAROON_DEEP },
  })
    .composite([
      { input: await sharp(SRC).png().toBuffer(), top: 0, left: 0 },
      { input: card, top: Y, left: X },
      { input: code, top: Y + PAD, left: X + PAD },
      { input: Buffer.from(captionSvg(W, BAND, { withQrColumn: false })), top: H, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'kg-poster-qr-inset.png'));
}

// --- version 2: picture untouched, code in a band beneath -------------------
{
  const QR = 264;
  const PAD = 16;
  const BAND = 352;
  // Centre the card in the band rather than letting it run to the edge.
  const cardH = QR + PAD * 2 + 10;
  const top = H + Math.round((BAND - cardH) / 2);

  const card = await sharp(Buffer.from(cardSvg(QR, PAD))).png().toBuffer();
  const code = await qrPanel(QR);

  await sharp({
    create: { width: W, height: H + BAND, channels: 3, background: MAROON_DEEP },
  })
    .composite([
      { input: await sharp(SRC).png().toBuffer(), top: 0, left: 0 },
      { input: Buffer.from(captionSvg(W, BAND, { withQrColumn: true })), top: H, left: 0 },
      { input: card, top, left: 62 },
      { input: code, top: top + PAD, left: 62 + PAD },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'kg-poster-qr-band.png'));
}

for (const f of ['kg-poster-qr-inset.png', 'kg-poster-qr-band.png']) {
  const m = await sharp(path.join(OUT, f)).metadata();
  console.log(`  ${f.padEnd(28)} ${m.width}×${m.height}  ${Math.round(m.size / 1024)} KB`);
}
