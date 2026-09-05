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

  hours: {
    // Confirmed by owner: Monday–Saturday, 11:00–20:00. Closed Sunday.
    openDays: [1, 2, 3, 4, 5, 6], // 0 = Sunday
    openHour: 11,
    closeHour: 20,
    label: 'Monday – Saturday, 11:00 AM – 8:00 PM',
    closedLabel: 'Closed on Sunday',
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
  { id: 'ring', name: 'Rings', makingPct: [8, 14], purity: '22K', typicalGrams: [2, 8] },
  { id: 'bangle', name: 'Bangles & Kada', makingPct: [10, 18], purity: '22K', typicalGrams: [10, 40] },
  { id: 'chain', name: 'Chains & Necklaces', makingPct: [9, 16], purity: '22K', typicalGrams: [8, 45] },
  { id: 'earring', name: 'Earrings & Tops', makingPct: [10, 16], purity: '22K', typicalGrams: [3, 12] },
  { id: 'coin', name: 'Coins & Biscuits', makingPct: [1, 3], purity: '24K', typicalGrams: [1, 100] },
];

/** Bullion the showroom retails. Weights only — no invented stock counts. */
export const BULLION = [
  { grams: 1, purity: '24K', form: 'Biscuit' },
  { grams: 2, purity: '24K', form: 'Biscuit' },
  { grams: 5, purity: '24K', form: 'Biscuit' },
  { grams: 10, purity: '24K', form: 'Biscuit' },
  { grams: 20, purity: '24K', form: 'Bar' },
  { grams: 50, purity: '24K', form: 'Bar' },
  { grams: 100, purity: '24K', form: 'Bar' },
];

export const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
