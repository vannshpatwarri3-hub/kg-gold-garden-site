/**
 * Single source of truth for every business fact on the site.
 *
 * Everything here was confirmed by the owner. Nothing in this file is invented —
 * if a fact is not listed here, the website does not claim it. In particular the
 * site makes exactly two trust claims (BIS hallmarking and 916/22K purity)
 * because those are the only two the owner confirmed.
 */

export const BUSINESS = {
  name: 'KG Gold Garden',
  tagline: 'Gold, grown with care.',
  city: 'Ahmedabad',
  established: null, // not supplied — the site never prints a founding year

  address: {
    line1: 'First Floor, Aastamangal Complex, 138–139',
    line2: 'Above HDFC Bank, near Rajasthan Hospital',
    area: 'Shahibaug',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380004',
    get full() {
      return `${this.line1}, ${this.line2}, ${this.area}, ${this.city}, ${this.state} ${this.pincode}`;
    },
  },

  // Google Maps search link built from the address string (no API key needed).
  get mapsUrl() {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `KG Gold Garden, ${this.address.full}`
    )}`;
  },

  owners: [
    { name: 'Sunil Patwari', phone: '8200329042', intl: '918200329042' },
    { name: 'Anil Patwari', phone: '9898703136', intl: '919898703136' },
  ],

  email: {
    // Primary address for every outbound and inbound message on this site.
    primary: 'primeplay345@gmail.com',
    displayName: 'KG Gold Garden',
  },

  social: {
    instagram: {
      handle: 'kggold_ahemdabad',
      url: 'https://www.instagram.com/kggold_ahemdabad/',
    },
  },

  hours: {
    // Confirmed by owner: Monday–Saturday, 11:00–20:00. Closed Sunday.
    openDays: [1, 2, 3, 4, 5, 6], // 0 = Sunday
    openHour: 11,
    closeHour: 20,
    label: 'Monday – Saturday, 11:00 AM – 8:00 PM',
    closedLabel: 'Closed on Sunday',
  },

  /**
   * The band under the hero.
   *
   * `years` and `clients` were given to us directly by the owner about their own
   * business, which is the only acceptable source for a claim like this.
   *
   * `googleRating` is deliberately null. A star rating is a third-party claim a
   * customer can go and check, so it must be the real figure from the shop's
   * Google Business profile — never an estimate and never a plausible-looking
   * number. Set it and the stat appears; leave it null and it stays hidden.
   */
  stats: {
    kicker: "Ahmedabad's premium jewellery store",
    items: [
      { key: 'years', value: 30, suffix: '+', label: 'Years experience', note: 'In the industry' },
      { key: 'googleRating', value: null, decimals: 1, label: 'Google rated', note: 'Star rating' },
      { key: 'clients', value: 10000, suffix: '+', label: 'Happy clients', note: 'And growing' },
    ],
  },

  // The only two assurances the owner confirmed.
  assurances: [
    {
      key: 'bis',
      title: 'BIS Hallmarked',
      body: 'Every piece of jewellery we sell carries the Bureau of Indian Standards hallmark. You are welcome to have any piece independently tested.',
    },
    {
      key: 'purity',
      title: '916 / 22K purity guarantee',
      body: 'Our jewellery is guaranteed 22-karat, 916 fineness. The purity you are billed for is the purity you take home.',
    },
  ],

  // Statutory rate on gold jewellery in India.
  gstRate: 0.03,
};

/** Karat → fineness, used by the price calculator. */
export const PURITY = {
  '24K': { label: '24K (999)', fineness: 0.999, rateKey: 'gold24' },
  '22K': { label: '22K (916)', fineness: 0.916, rateKey: 'gold22' },
  '18K': { label: '18K (750)', fineness: 0.75, rateKey: 'gold18' },
};

/**
 * Jewellery categories. `makingPct` is the making-charge band the showroom
 * quotes — it is a *range*, and the calculator says so rather than pretending a
 * single exact figure. The owner can edit these freely.
 */
export const CATEGORIES = [
  { id: 'ring', name: 'Rings', makingPct: [8, 14], purity: '22K', karats: ['18K', '22K'], typicalGrams: [2, 15] },
  { id: 'bangle', name: 'Bangles & Kada', makingPct: [10, 18], purity: '22K', karats: ['18K', '22K'], typicalGrams: [10, 40] },
  { id: 'chain', name: 'Chains & Necklaces', makingPct: [9, 16], purity: '22K', karats: ['18K', '22K'], typicalGrams: [8, 45] },
  { id: 'earring', name: 'Earrings & Tops', makingPct: [10, 16], purity: '22K', karats: ['18K', '22K'], typicalGrams: [3, 12] },
  { id: 'coin', name: 'Coins & Biscuits', makingPct: [1, 3], purity: '24K', karats: ['24K'], typicalGrams: [1, 100] },
  { id: 'necklace-set', name: 'Necklace Sets', makingPct: [12, 20], purity: '22K', karats: ['18K', '22K'], typicalGrams: [25, 90] },
  { id: 'necklace', name: 'Necklaces & Pendants', makingPct: [10, 18], purity: '22K', karats: ['18K', '22K'], typicalGrams: [5, 30] },
  { id: 'band', name: 'Half-kada Bands', makingPct: [12, 20], purity: '18K', karats: ['18K', '22K'], typicalGrams: [3, 12] },
];

/**
 * The subheads the pieces are grouped under in "Our pieces". Order here is the
 * order on the page. A group with nothing in it is not rendered at all.
 */
export const COLLECTIONS = [
  { id: 'necklace-set', name: 'Necklace sets', blurb: 'Necklace and earrings, made as a pair.' },
  { id: 'necklace', name: 'Necklaces & pendants', blurb: 'Worn on their own, every day.' },
  { id: 'chain', name: 'Chains', blurb: 'Plain and patterned, in every length we keep.' },
  { id: 'ring', name: 'Rings', blurb: 'From a single stone to full antique work.' },
  { id: 'earring', name: 'Earrings', blurb: 'Studs, drops and jhumkas.' },
  { id: 'bangle', name: 'Kada & bangles', blurb: 'Plain, carved, and stone-set.' },
  { id: 'band', name: 'Half-kada bands', blurb: 'A gold fitting on a soft band, for everyday wear.' },
  { id: 'coin', name: 'Gold biscuits & coins', blurb: '999 fine, bought as savings rather than to wear.' },
];

/**
 * Finish is a colour, not a purity. Rose gold is gold alloyed with copper, so a
 * rose piece and a yellow piece of the same karat contain the same gold and are
 * billed on the same per-gram rate.
 *
 * 24K is pure gold by definition — there is no alloy in it — so 24K rose gold
 * does not exist and the calculator will not offer it.
 */
export const FINISHES = [
  {
    id: 'yellow',
    name: 'Yellow gold',
    hex: '#FFC85C',
    karats: ['18K', '22K', '24K'],
    note: 'The traditional finish. Most of our 916 jewellery is yellow.',
  },
  {
    id: 'rose',
    name: 'Rose gold',
    hex: '#E8A07C',
    karats: ['18K', '22K'],
    note: 'Gold alloyed with copper for the pink tone. Same karat means the same gold content — and the same per-gram rate.',
  },
];

/** Bullion the showroom retails. Weights only — no invented stock counts. */
export const BULLION = [
  { grams: 1, purity: '24K', form: 'Biscuit', image: '/assets/products/bar-1g.webp' },
  { grams: 2, purity: '24K', form: 'Biscuit', image: '/assets/products/bar-2g.webp' },
  { grams: 5, purity: '24K', form: 'Biscuit', image: '/assets/products/bar-5g.webp' },
  { grams: 10, purity: '24K', form: 'Biscuit', image: '/assets/products/biscuit-10g-a.webp' },
  // No photograph for these two yet — they fall back to the drawn ingot.
  { grams: 20, purity: '24K', form: 'Bar', image: null },
  { grams: 50, purity: '24K', form: 'Bar', image: '/assets/products/bar-50g.webp' },
  { grams: 100, purity: '24K', form: 'Bar', image: null },
];

export const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
