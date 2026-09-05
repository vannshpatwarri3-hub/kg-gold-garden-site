import { $, $$, inr, esc, countTo, reducedMotion } from './lib.js';

/**
 * Eases a displayed number toward its target instead of snapping to it. Dragging
 * a slider then reads as one continuous movement rather than a flicker of
 * unrelated figures, and it stays responsive because each new input just moves
 * the target — it never queues up another animation.
 */
function smoothNumber(el, format) {
  let current = null;
  let target = 0;
  let raf = 0;

  const tick = () => {
    const diff = target - current;
    // Close enough that another frame would not be visible.
    if (Math.abs(diff) < Math.max(0.5, Math.abs(target) * 0.0004)) {
      current = target;
      el.textContent = format(current);
      raf = 0;
      return;
    }
    current += diff * 0.3;
    el.textContent = format(current);
    raf = requestAnimationFrame(tick);
  };

  return (value) => {
    target = value;
    if (current === null || reducedMotion()) {
      current = value;
      el.textContent = format(value);
      return;
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };
}

/**
 * Mirrors server/rates.js computePrice() exactly, so the slider can respond
 * instantly without a round trip. The server remains authoritative for anything
 * that gets recorded.
 */
function priceOf({ ratePerGram, grams, makingPct, gstRate }) {
  const metal = ratePerGram * grams;
  const making = metal * (makingPct / 100);
  const subtotal = metal + making;
  const gst = subtotal * gstRate;
  return { metal, making, gst, total: subtotal + gst };
}

const RATE_KEY = { '24K': 'gold24', '22K': 'gold22', '18K': 'gold18' };

export function initRates({ config, rates }) {
  // --- headline numbers, wherever they appear -----------------------------
  $$('[data-rate]').forEach((el) => {
    const value = rates[el.dataset.rate];
    if (!Number.isFinite(value)) return;
    countTo(el, value, (n) => inr(n));
  });

  // --- provenance: say plainly where the number came from ------------------
  const stamp = $('#rateStamp');
  if (stamp) {
    if (rates.isPlaceholder) {
      stamp.textContent = 'Placeholder figures — not yet set by the showroom.';
      stamp.classList.add('dim');
    } else {
      const when = new Date(rates.updatedAt);
      stamp.textContent = `Set by our showroom on ${when.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })} at ${when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.`;
    }
  }

  const banner = $('#rateBanner');
  const bannerText = $('#rateBannerText');
  if (banner && bannerText) {
    if (rates.isPlaceholder) {
      bannerText.textContent =
        'These rates are placeholders and have not been set by KG Gold Garden yet. Please confirm the day’s rate on WhatsApp or by phone before relying on any figure here.';
      banner.hidden = false;
    } else if (rates.isStale) {
      bannerText.textContent =
        'This rate has not been refreshed today. Please confirm with us before you finalise anything.';
      banner.hidden = false;
    }
  }

  // Anchor the alert box to what 22K actually costs today.
  const alertHint = $('#subAlertHint');
  if (alertHint && Number.isFinite(rates.gold22)) {
    alertHint.textContent = `22K is ${inr(rates.gold22)} today. Leave blank for the daily rates only.`;
  }

  // --- "open today" in the hero -------------------------------------------
  const openEl = $('[data-open-state]');
  if (openEl) {
    const now = new Date();
    const day = now.getDay();
    const isOpenDay = config.business.hours.openDays.includes(day);
    const hour = now.getHours() + now.getMinutes() / 60;
    const openNow = isOpenDay && hour >= config.business.hours.openHour && hour < config.business.hours.closeHour;
    openEl.textContent = openNow ? 'Open now' : isOpenDay ? '11 AM – 8 PM' : 'Closed today';
  }
}

export function initCalculator({ config, rates }) {
  const form = $('#calc');
  if (!form) return;

  const categorySel = $('#calcCategory');
  const karatSel = $('#calcKarat');
  const finishSel = $('#calcFinish');
  const finishNote = $('#calcFinishNote');
  const weight = $('#calcWeight');
  const making = $('#calcMaking');
  const weightOut = $('#calcWeightOut');
  const makingOut = $('#calcMakingOut');
  const hint = $('#calcMakingHint');
  const waLink = $('#calcWhatsapp');

  const cats = config.categories;
  const finishes = config.finishes ?? [];

  categorySel.innerHTML = cats
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
    .join('');

  const fill = (input) => {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  };

  const setMetal = smoothNumber($('#calcMetal'), inr);
  const setMaking = smoothNumber($('#calcMaking2'), inr);
  const setGst = smoothNumber($('#calcGst'), inr);
  const setTotal = smoothNumber($('#calcTotal'), inr);

  /** Tint the stretch of the track we usually quote for this category. */
  const paintBand = () => {
    const band = $('#calcMakingBand');
    if (!band) return;
    const [lo, hi] = currentCategory().makingPct;
    const span = Number(making.max) - Number(making.min);
    band.style.setProperty('--band-lo', String((lo - making.min) / span));
    band.style.setProperty('--band-hi', String((hi - making.min) / span));
  };

  function currentCategory() {
    return cats.find((c) => c.id === categorySel.value) ?? cats[0];
  }

  /** Karats this category is actually made in. */
  function paintKarats() {
    const c = currentCategory();
    const allowed = c.karats ?? [c.purity];
    const keep = allowed.includes(karatSel.value) ? karatSel.value : c.purity;
    karatSel.innerHTML = allowed
      .map((k) => `<option value="${esc(k)}">${esc(config.purity[k]?.label ?? k)}</option>`)
      .join('');
    karatSel.value = keep;
    karatSel.disabled = allowed.length < 2;
  }

  /**
   * Finish depends on karat, not the other way round: 24K is pure gold, so there
   * is no copper in it to make it rose. We drop the option rather than offer a
   * thing that cannot exist.
   */
  function paintFinishes() {
    const karat = karatSel.value;
    const allowed = finishes.filter((f) => f.karats.includes(karat));
    const keep = allowed.some((f) => f.id === finishSel.value) ? finishSel.value : allowed[0]?.id;

    finishSel.innerHTML = allowed.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    if (keep) finishSel.value = keep;
    finishSel.disabled = allowed.length < 2;

    const chosen = finishes.find((f) => f.id === finishSel.value);
    finishNote.textContent =
      allowed.length < 2 && karat === '24K'
        ? 'Pure 24K gold has no alloy in it, so it is only made in yellow.'
        : (chosen?.note ?? '');
  }

  function applyCategoryDefaults() {
    const c = currentCategory();
    const [lo, hi] = c.typicalGrams;
    weight.min = Math.max(1, lo);
    weight.max = Math.max(hi, lo + 1);
    weight.value = Math.round((lo + hi) / 2);

    const [mlo, mhi] = c.makingPct;
    making.value = ((mlo + mhi) / 2).toFixed(1);
    hint.textContent = `We usually quote between ${mlo}% and ${mhi}% on ${c.name.toLowerCase()}.`;

    paintKarats();
    paintFinishes();
    paintBand();
    update();
  }

  function update() {
    fill(weight);
    fill(making);

    const c = currentCategory();
    const karat = karatSel.value || c.purity;
    const finish = finishes.find((f) => f.id === finishSel.value);
    const grams = Number(weight.value);
    const pct = Number(making.value);
    const ratePerGram = rates[RATE_KEY[karat]];

    // Only show a decimal when there actually is one.
    weightOut.textContent = `${Number(grams.toFixed(1))} g`;
    makingOut.textContent = `${Number(pct.toFixed(2))}%`;

    const p = priceOf({ ratePerGram, grams, makingPct: pct, gstRate: config.business.gstRate });

    setMetal(p.metal);
    setMaking(p.making);
    setGst(p.gst);
    setTotal(p.total);

    const owner = config.business.owners[0];
    const msg =
      `Hello ${config.business.name}, I used the calculator on your website.\n\n` +
      `${c.name} · ${karat}${finish ? ` · ${finish.name}` : ''}\n` +
      `Weight: ${grams} g\nMaking: ${pct}%\n` +
      `Estimated total: ${inr(p.total)}\n\nCould you give me an exact quote?`;
    waLink.href = `https://wa.me/91${owner.phone}?text=${encodeURIComponent(msg)}`;
  }

  categorySel.addEventListener('change', applyCategoryDefaults);
  karatSel.addEventListener('change', () => {
    paintFinishes();
    update();
  });
  finishSel.addEventListener('change', () => {
    paintFinishes();
    update();
  });
  weight.addEventListener('input', update);
  making.addEventListener('input', update);
  form.addEventListener('submit', (e) => e.preventDefault());

  applyCategoryDefaults();
}

export function initBullion({ config, rates }) {
  const grid = $('#bullionGrid');
  if (!grid) return;

  const gstRate = config.business.gstRate;
  const makingPct = 2; // nominal premium on bullion; jewellery is far higher
  const owner = config.business.owners[0];

  const heaviest = Math.max(...config.bullion.map((b) => b.grams));

  grid.innerHTML = config.bullion
    .map((b) => {
      const p = priceOf({ ratePerGram: rates.gold24, grams: b.grams, makingPct, gstRate });
      const msg =
        `Hello ${config.business.name}, I would like to enquire about a ` +
        `${b.grams} g 24K gold ${b.form.toLowerCase()}. Is it available today?`;

      // Size each drawn ingot against the heaviest, on a log scale — a 100 g bar
      // is not a hundred times the size of a 1 g one, and shouldn't look it.
      const t = Math.log(b.grams) / Math.log(heaviest);
      const w = Math.round(56 + 44 * t);
      const h = Math.round(52 + 30 * t);

      // A real photograph wins; the drawn ingot is the fallback for weights we
      // have no picture of yet.
      const art = b.image
        ? `<img class="bullion-card__photo" src="${esc(b.image)}" alt="${esc(String(b.grams))} gram 24K gold ${esc(b.form.toLowerCase())}" loading="lazy">`
        : `<div class="bullion-card__ingot" aria-hidden="true" style="width:${w}%;height:${h}px"></div>`;

      return `
        <article class="bullion-card">
          ${art}
          <p class="bullion-card__weight">${b.grams} g</p>
          <p class="bullion-card__form">${esc(b.purity)} · ${esc(b.form)}</p>
          <p class="bullion-card__price">${inr(p.total)}</p>
          <p class="bullion-card__tax">incl. 3% GST · indicative</p>
          <a class="bullion-card__cta" href="https://wa.me/91${esc(owner.phone)}?text=${encodeURIComponent(msg)}"
             target="_blank" rel="noopener">
            Check availability
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </article>`;
    })
    .join('');
}
