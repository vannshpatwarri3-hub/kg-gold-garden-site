/**
 * Daily gold rate storage and price computation.
 *
 * IMPORTANT — honesty rule: this project does not know the real market rate, so
 * the seeded file is flagged `source: "placeholder"` and the website renders a
 * visible warning until the showroom sets a real figure via POST /api/rates.
 * Nothing here silently presents an invented number as fact.
 */
import { BUSINESS, PURITY } from './config.js';
import { readJson, writeJson } from './store.js';

const FILE = 'rates.json';

const SEED = {
  // Placeholder values ONLY. Clearly flagged, and surfaced as such in the UI.
  gold24: 9980,
  gold22: 9150,
  silver: 115,
  currency: 'INR',
  unit: 'per gram',
  source: 'placeholder',
  updatedAt: null,
  updatedBy: null,
  history: [],
};

export async function getRates() {
  const stored = await readJson(FILE, null);
  if (!stored) {
    await writeJson(FILE, SEED);
    return decorate(SEED);
  }
  return decorate(stored);
}

function decorate(r) {
  // 18K is derived from the 24K rate unless the showroom set it explicitly.
  const gold18 = r.gold18 ?? Math.round((r.gold24 * 0.75) / 0.999);
  return {
    ...r,
    gold18,
    isPlaceholder: r.source === 'placeholder',
    // A rate older than one open day is stale enough to say so.
    isStale: r.updatedAt ? Date.now() - new Date(r.updatedAt).getTime() > 36 * 3600e3 : true,
  };
}

const isPositiveNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

export async function setRates(input, actor = 'showroom') {
  const current = await readJson(FILE, SEED);
  const next = { ...current };

  for (const key of ['gold24', 'gold22', 'gold18', 'silver']) {
    if (input[key] === undefined || input[key] === null || input[key] === '') continue;
    const value = Number(input[key]);
    if (!isPositiveNumber(value)) {
      throw Object.assign(new Error(`"${key}" must be a positive number`), { status: 400 });
    }
    if (value > 1_000_000) {
      throw Object.assign(new Error(`"${key}" looks wrong — that is a per-gram rate`), { status: 400 });
    }
    next[key] = Math.round(value * 100) / 100;
  }

  if (!isPositiveNumber(next.gold24) || !isPositiveNumber(next.gold22)) {
    throw Object.assign(new Error('Both gold24 and gold22 are required'), { status: 400 });
  }
  if (next.gold22 >= next.gold24) {
    throw Object.assign(new Error('The 22K rate must be lower than the 24K rate'), { status: 400 });
  }

  next.source = 'showroom';
  next.updatedAt = new Date().toISOString();
  next.updatedBy = actor;
  next.history = [
    ...(current.history ?? []).slice(-59),
    { at: next.updatedAt, gold24: next.gold24, gold22: next.gold22, silver: next.silver },
  ];

  await writeJson(FILE, next);
  return decorate(next);
}

/**
 * Indian jewellery billing:
 *   metal        = rate/gram x weight
 *   making       = metal x making%
 *   GST (3%)     = (metal + making) x 0.03
 *   total        = metal + making + GST
 */
export function computePrice({ rates, grams, purity, makingPct }) {
  const spec = PURITY[purity];
  if (!spec) throw Object.assign(new Error(`Unknown purity "${purity}"`), { status: 400 });

  const weight = Number(grams);
  if (!isPositiveNumber(weight) || weight > 5000) {
    throw Object.assign(new Error('Weight must be between 0 and 5000 grams'), { status: 400 });
  }

  const pct = Number(makingPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 40) {
    throw Object.assign(new Error('Making charge must be between 0% and 40%'), { status: 400 });
  }

  const ratePerGram = rates[spec.rateKey];
  const metal = ratePerGram * weight;
  const making = metal * (pct / 100);
  const subtotal = metal + making;
  const gst = subtotal * BUSINESS.gstRate;

  const round = (n) => Math.round(n * 100) / 100;
  return {
    purity: spec.label,
    grams: weight,
    ratePerGram,
    makingPct: pct,
    metal: round(metal),
    making: round(making),
    subtotal: round(subtotal),
    gstRate: BUSINESS.gstRate,
    gst: round(gst),
    total: round(subtotal + gst),
    isPlaceholder: rates.isPlaceholder,
  };
}
