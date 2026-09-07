/**
 * Builds every image the site needs from the shop's own logo.
 *
 *   node scripts/build-logo.mjs
 *
 * The source is the logo as supplied — a phone-sized artwork with the medallion
 * sitting on a dark ground. The medallion's centre and radius below were
 * measured off that file, not guessed; if the logo is ever replaced, re-measure
 * them rather than hoping the old numbers still land.
 *
 * What comes out:
 *   assets/logo-mark.png   the medallion alone, cut to a circle, transparent
 *                          outside it, so it sits on the ivory header
 *   favicon-32.png         browser tab
 *   apple-touch-icon.png   home screen on iPhone — no transparency, iOS fills
 *                          transparent pixels with black
 *   assets/og-image.jpg    what WhatsApp, Facebook and Google show when someone
 *                          shares or finds the site
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/assets/logo-full.jpg');
const PUB = path.join(ROOT, 'public');

// Measured off the supplied artwork.
const MEDALLION = { cx: 517, cy: 888, r: 384 };

const GOLD_LIGHT = '#F6E3B4';
const GOLD = '#D9AE58';
const GOLD_DEEP = '#A87E2C';
const INK = '#0B0806';

/** The medallion, cut to a circle, at whatever size is asked for. */
function mark(size) {
  const { cx, cy, r } = MEDALLION;
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${
      size / 2 - 1
    }" fill="#fff"/></svg>`
  );
  return sharp(SRC)
    .extract({ left: cx - r, top: cy - r, width: r * 2, height: r * 2 })
    .resize(size, size)
    .composite([{ input: circle, blend: 'dest-in' }])
    .png();
}

// 256 is four times what the header ever shows, even on a 3x phone screen, and
// a 512 version of a photographic medallion costs nearly half a megabyte —
// which is a real cost on Indian mobile data for an image the size of a thumb.
await mark(256)
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(path.join(PUB, 'assets/logo-mark.png'));

await mark(64).png({ compressionLevel: 9, palette: true }).toFile(path.join(PUB, 'favicon-32.png'));

// iOS paints transparent pixels black and squares the corners itself, so this
// one keeps the logo's own dark ground rather than a cut-out circle.
await sharp({
  create: { width: 180, height: 180, channels: 3, background: INK },
})
  .composite([{ input: await mark(164).toBuffer(), top: 8, left: 8 }])
  .png()
  .toFile(path.join(PUB, 'apple-touch-icon.png'));

// --- the share card ---------------------------------------------------------

const W = 1200;
const H = 630;

const card = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="26%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#3A2A12"/>
      <stop offset="55%" stop-color="#181008"/>
      <stop offset="100%" stop-color="${INK}"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="60%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10"
        fill="none" stroke="${GOLD_DEEP}" stroke-opacity=".42" stroke-width="1.5"/>

  <!-- textLength pins each line to a width that fits, so a font substitution on
       another machine can never push a line off the right edge. -->
  <text x="545" y="248" font-family="Georgia, 'Times New Roman', serif"
        font-size="58" font-weight="700" fill="url(#ink)"
        textLength="580" lengthAdjust="spacingAndGlyphs">KG GOLD GARDEN</text>

  <line x1="547" y1="286" x2="1085" y2="286" stroke="${GOLD_DEEP}" stroke-opacity=".55" stroke-width="1.4"/>

  <text x="547" y="334" font-family="Georgia, 'Times New Roman', serif"
        font-size="22" fill="${GOLD}" fill-opacity=".92"
        textLength="530" lengthAdjust="spacingAndGlyphs">TRUSTED FOR A BRIGHTER TOMORROW</text>

  <text x="547" y="414" font-family="Segoe UI, Arial, sans-serif"
        font-size="30" fill="#EFE4CE" fill-opacity=".93"
        textLength="298" lengthAdjust="spacingAndGlyphs">Shahibaug, Ahmedabad</text>

  <text x="547" y="462" font-family="Segoe UI, Arial, sans-serif"
        font-size="24" fill="#C9B999" fill-opacity=".88"
        textLength="538" lengthAdjust="spacingAndGlyphs">BIS hallmarked 916 jewellery &amp; 999 gold biscuits</text>

  <text x="547" y="508" font-family="Segoe UI, Arial, sans-serif"
        font-size="24" fill="#C9B999" fill-opacity=".88"
        textLength="252" lengthAdjust="spacingAndGlyphs">Mon–Sat, 11 AM – 8 PM</text>
</svg>`);

await sharp(card)
  .composite([{ input: await mark(404).toBuffer(), top: (H - 404) / 2, left: 92 }])
  .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
  .toFile(path.join(PUB, 'assets/og-image.jpg'));

console.log('Built:');
for (const f of [
  'assets/logo-mark.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'assets/og-image.jpg',
]) {
  const { size } = await sharp(path.join(PUB, f)).metadata().then(async (m) => ({
    size: `${m.width}×${m.height}`,
  }));
  console.log(`  ${f.padEnd(24)} ${size}`);
}
