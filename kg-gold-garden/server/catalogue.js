/**
 * Products and customer words.
 *
 * Both files live in data/ so the showroom can edit them without touching code.
 * Both carry a `status` field: while it is "sample" the website shows a visible
 * banner saying so. Nothing here is presented as a real piece in stock, or as a
 * real customer, until the owner sets `"status": "live"`.
 */
import { readJson, writeJson } from './store.js';
import { getRates, computePrice } from './rates.js';
import { CATEGORIES } from './config.js';

const PRODUCTS_FILE = 'products.json';
const TESTIMONIALS_FILE = 'testimonials.json';

/**
 * Seed catalogue. Weights and making percentages are ordinary for each form, and
 * `image: null` renders a styled placeholder rather than a broken picture — drop
 * a file into public/assets/products/ and put its path here.
 */
const PRODUCT_SEED = {
  status: 'sample',
  note: 'Replace these with your own pieces and photographs, then set "status": "live" to remove the banner on the website.',
  items: [
    { id: 'p1', name: 'Plain Round Kada', category: 'bangle', karat: '22K', finish: 'yellow', grams: 24, makingPct: 12, image: null, blurb: 'A smooth, unadorned kada. All the weight goes into the gold, none into the design.' },
    { id: 'p2', name: 'Solitaire Band', category: 'ring', karat: '18K', finish: 'rose', grams: 4.5, makingPct: 13, image: null, blurb: 'A slim rose band with a single set stone, finished by hand.' },
    { id: 'p3', name: 'Rope Chain', category: 'chain', karat: '22K', finish: 'yellow', grams: 18, makingPct: 11, image: null, blurb: 'A classic twisted rope chain that sits well on its own or with a pendant.' },
    { id: 'p4', name: 'Jhumka Earrings', category: 'earring', karat: '22K', finish: 'yellow', grams: 9, makingPct: 15, image: null, blurb: 'Traditional bell-drop jhumkas with fine granulation along the dome.' },
    { id: 'p5', name: 'Half-Kada Bracelet', category: 'bangle', karat: '18K', finish: 'rose', grams: 14, makingPct: 14, image: null, blurb: 'A lighter everyday bracelet in rose gold, comfortable under a sleeve.' },
    { id: 'p6', name: 'Gold Biscuit, 10 g', category: 'coin', karat: '24K', finish: 'yellow', grams: 10, makingPct: 2, image: null, blurb: '999 fine, sealed and assay-marked. Bought for savings rather than for wearing.' },
  ],
};

/**
 * Off by default. An animated row of quotes is built and ready, but it ships
 * hidden so placeholder text can never be mistaken for real reviews. Put real
 * words in `items`, set `"status": "live"`, and the section appears.
 */
const TESTIMONIAL_SEED = {
  status: 'hidden',
  note: 'Set "status": "live" once you have replaced these with words real customers actually gave you. Do not publish invented reviews.',
  items: [
    { id: 't1', name: 'Sample entry', city: 'Ahmedabad', text: 'Replace this with something a real customer told you. Keep it in their words — it reads better than anything written for them.' },
    { id: 't2', name: 'Sample entry', city: 'Ahmedabad', text: 'A second placeholder. Three or four short quotes work better on this row than one long one.' },
    { id: 't3', name: 'Sample entry', city: 'Ahmedabad', text: 'Ask a customer you know well if you may print what they said. Most people are happy to be asked.' },
    { id: 't4', name: 'Sample entry', city: 'Ahmedabad', text: 'If you have none yet, set "status" to "hidden" in data/testimonials.json and this whole section disappears.' },
  ],
};

const KARAT_MAKING_FALLBACK = 12;

export async function getProducts() {
  let file = await readJson(PRODUCTS_FILE, null);
  if (!file) {
    await writeJson(PRODUCTS_FILE, PRODUCT_SEED);
    file = PRODUCT_SEED;
  }

  const rates = await getRates();
  const items = (file.items ?? []).map((p) => {
    const category = CATEGORIES.find((c) => c.id === p.category);
    let price = null;
    try {
      price = computePrice({
        rates,
        grams: p.grams,
        purity: p.karat,
        makingPct: p.makingPct ?? KARAT_MAKING_FALLBACK,
      });
    } catch {
      price = null; // a bad row should not take the whole page down
    }
    return {
      ...p,
      categoryName: category?.name ?? null,
      price,
    };
  });

  return {
    status: file.status ?? 'live',
    isSample: (file.status ?? 'live') === 'sample',
    ratesArePlaceholder: rates.isPlaceholder,
    items,
  };
}

export async function getTestimonials() {
  let file = await readJson(TESTIMONIALS_FILE, null);
  if (!file) {
    await writeJson(TESTIMONIALS_FILE, TESTIMONIAL_SEED);
    file = TESTIMONIAL_SEED;
  }
  const status = file.status ?? 'live';
  return {
    status,
    isSample: status === 'sample',
    hidden: status === 'hidden',
    items: status === 'hidden' ? [] : (file.items ?? []),
  };
}
