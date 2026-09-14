import { $, api, inr, esc, reducedMotion } from './lib.js';
import { initShortlist } from './shortlist.js';

/**
 * The standing band under the hero.
 *
 * Only stats the server actually sent are rendered — the Google rating stays out
 * of the markup entirely until a real figure is put in server/config.js, because
 * a star rating is a claim a customer can go and verify.
 */
export function initStanding({ config }) {
  const section = $('#standing');
  const row = $('#standingRow');
  const kicker = $('#standingKicker');
  const stats = config.business.stats;

  if (!section || !row || !stats?.items?.length) return;

  kicker.textContent = stats.kicker;

  const format = (value, item) =>
    (item.decimals
      ? value.toFixed(item.decimals)
      : Math.round(value).toLocaleString('en-IN')) + (item.suffix ?? '');

  row.innerHTML = stats.items
    .map(
      (item) => `
      <div class="standing__stat">
        <dd class="standing__value" data-target="${esc(String(item.value))}"
            data-decimals="${esc(String(item.decimals ?? 0))}"
            data-suffix="${esc(item.suffix ?? '')}">${esc(format(0, item))}</dd>
        <dt>
          <span class="standing__label">${esc(item.label)}</span>
          ${item.note ? `<span class="standing__note">${esc(item.note)}</span>` : ''}
        </dt>
      </div>`
    )
    .join('');

  section.hidden = false;

  const values = Array.from(row.querySelectorAll('.standing__value'));

  const settle = (el) => {
    const target = Number(el.dataset.target);
    const decimals = Number(el.dataset.decimals);
    const suffix = el.dataset.suffix;
    el.textContent =
      (decimals ? target.toFixed(decimals) : Math.round(target).toLocaleString('en-IN')) + suffix;
  };

  if (reducedMotion() || !('IntersectionObserver' in window)) {
    values.forEach(settle);
    return;
  }

  // Count up once, when the band first comes into view.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);

        const el = entry.target;
        const target = Number(el.dataset.target);
        const decimals = Number(el.dataset.decimals);
        const suffix = el.dataset.suffix;
        const start = performance.now();
        const ms = 1400;

        const tick = (now) => {
          const p = Math.min(1, (now - start) / ms);
          const eased = 1 - Math.pow(1 - p, 3);
          const v = target * eased;
          el.textContent =
            (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-IN')) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.4 }
  );

  values.forEach((el) => io.observe(el));
}

/**
 * Stand-in artwork, used until real photographs are dropped into
 * public/assets/products/. Deliberately abstract — it should read as "no photo
 * yet", never as a picture of an actual piece.
 */
const PLACEHOLDER = {
  ring: '<circle cx="60" cy="64" r="30" fill="none" stroke="url(#g)" stroke-width="9"/><path d="M60 22l7 10H53z" fill="url(#g)"/>',
  bangle: '<circle cx="60" cy="60" r="38" fill="none" stroke="url(#g)" stroke-width="7"/><circle cx="60" cy="60" r="30" fill="none" stroke="url(#g)" stroke-width="2" opacity=".5"/>',
  chain: '<path d="M30 60h60" stroke="url(#g)" stroke-width="7" stroke-linecap="round"/><circle cx="60" cy="78" r="12" fill="none" stroke="url(#g)" stroke-width="6"/>',
  earring: '<circle cx="42" cy="38" r="7" fill="url(#g)"/><path d="M42 45v18" stroke="url(#g)" stroke-width="4"/><path d="M28 63h28l-14 22z" fill="url(#g)"/><circle cx="82" cy="38" r="7" fill="url(#g)"/><path d="M82 45v18" stroke="url(#g)" stroke-width="4"/><path d="M68 63h28l-14 22z" fill="url(#g)"/>',
  coin: '<rect x="24" y="44" width="72" height="34" rx="5" fill="url(#g)"/><rect x="34" y="52" width="52" height="18" rx="2" fill="none" stroke="#8A6114" stroke-width="1.6" opacity=".5"/>',
};

function placeholderSvg(category) {
  const art = PLACEHOLDER[category] ?? PLACEHOLDER.ring;
  return `<svg class="product__art" viewBox="0 0 120 120" role="img" aria-label="Photograph coming soon">
    <defs><linearGradient id="g" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E8C46E"/><stop offset=".55" stop-color="#C29433"/><stop offset="1" stop-color="#8A6114"/>
    </linearGradient></defs>${art}</svg>`;
}

export async function initProducts({ config }) {
  const grid = $('#productsGrid');
  if (!grid) return;

  let data;
  try {
    data = await api('/api/products');
  } catch {
    grid.closest('section')?.setAttribute('hidden', '');
    return;
  }

  const banner = $('#productsBanner');
  const bannerText = $('#productsBannerText');
  const notes = [];
  if (data.isSample) {
    notes.push(
      'These are sample pieces, not our actual stock — the showroom has not put its own catalogue in yet.'
    );
  }
  if (data.ratesArePlaceholder) {
    notes.push('Prices are based on a placeholder gold rate, so please confirm before relying on them.');
  }
  if (notes.length && banner && bannerText) {
    bannerText.textContent = notes.join(' ');
    banner.hidden = false;
  }

  const owner = config.business.owners[0];
  const lookup = new Map();
  const WA_ICON =
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2A9.9 9.9 0 0 0 3.6 17.1L2.05 22l5.05-1.5A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-2 1.37-.51.05-1.16.07-1.87-.12a15.6 15.6 0 0 1-2.5-1.05 12.2 12.2 0 0 1-4.2-4.36c-.3-.5-.75-1.4-.75-2.32s.48-1.4.66-1.6c.18-.2.4-.24.53-.24h.38c.13 0 .3-.03.47.36l.72 1.74c.06.13.1.28.02.44-.09.17-.13.27-.25.42l-.37.43c-.12.12-.25.26-.1.5.13.25.6 1 1.3 1.62.9.8 1.65 1.05 1.9 1.17.24.13.38.11.52-.06l.75-.87c.17-.2.31-.15.52-.08l1.67.79c.24.12.4.18.46.28.06.1.06.6-.19 1.3Z"/></svg>';

  const card = (p, groupName) => {
    const price = p.price ? inr(p.price.total) : null;
    const finishLabel = p.finish === 'rose' ? 'Rose gold' : p.finish === 'yellow' ? 'Yellow gold' : null;

    // Every card asks the same two things the owner wants asked.
    const lines = [
      `Hello ${config.business.name}, I saw this piece on your website:`,
      '',
      p.name,
      [groupName, p.karat, finishLabel, p.grams ? `${p.grams} g` : null].filter(Boolean).join(' · '),
    ];
    if (price) lines.push(`Shown on the website at ${price}`);
    lines.push(
      '',
      price
        ? 'Could you confirm the price, and can I book a time to come and see it?'
        : 'Could you tell me the price, and can I book a time to come and see it?'
    );
    const href = `https://wa.me/91${owner.waPhone ?? owner.phone}?text=${encodeURIComponent(lines.join('\n'))}`;

    // Only state facts the showroom actually supplied.
    const meta = [p.karat, finishLabel, p.grams ? `${p.grams} g` : null].filter(Boolean).join(' · ');

    // Remembered so the enlarged view can be opened without another request.
    lookup.set(p.id, { ...p, groupName, href, priceLabel: price });

    return `
      <a class="product" role="listitem" href="${esc(href)}" target="_blank" rel="noopener"
         data-product="${esc(p.id)}"
         aria-label="View ${esc(p.name)}">
        <span class="product__media${p.image ? ' has-photo' : ''}">
          ${
            p.image
              ? `<img class="product__photo" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
              : placeholderSvg(p.category)
          }
          ${p.image ? '' : '<span class="product__soon">Photograph coming soon</span>'}
          <button type="button" class="product__save" data-save="${esc(p.id)}"
                  aria-pressed="false" aria-label="Save ${esc(p.name)} to your shortlist">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>
          </button>
        </span>
        <span class="product__body">
          <span class="product__name">${esc(p.name)}</span>
          ${meta ? `<span class="product__meta">${esc(meta)}</span>` : ''}
          ${p.blurb ? `<span class="product__blurb">${esc(p.blurb)}</span>` : '<span class="product__blurb"></span>'}
          <span class="product__foot">
            <span class="product__price${price ? '' : ' product__price--ask'}">${
              price ? esc(price) : 'Price on request'
            }</span>
            <span class="product__cta">${WA_ICON}${price ? 'Enquire' : 'Ask &amp; book'}</span>
          </span>
          ${
            p.price
              ? `<span class="product__breakup">${esc(inr(p.price.metal))} metal + ${esc(inr(p.price.making))} making + 3% GST</span>`
              : ''
          }
        </span>
      </a>`;
  };

  const groups = data.groups?.length
    ? data.groups
    : [{ id: 'all', name: '', blurb: '', items: data.items }];

  grid.innerHTML = groups
    .map(
      (g) => `
      <section class="collection" aria-labelledby="col-${esc(g.id)}">
        ${
          g.name
            ? `<header class="collection__head">
                 <h3 class="collection__name" id="col-${esc(g.id)}">${esc(g.name)}</h3>
                 ${g.blurb ? `<p class="collection__blurb">${esc(g.blurb)}</p>` : ''}
                 <span class="collection__count">${g.items.length} piece${g.items.length === 1 ? '' : 's'}</span>
               </header>`
            : ''
        }
        <div class="collection__grid" role="list">
          ${g.items.map((p) => card(p, g.name)).join('')}
        </div>
      </section>`
    )
    .join('');

  const shortlist = initShortlist({ lookup, config });

  // Keep every heart on the page in step with the saved list.
  const syncHearts = () => {
    grid.querySelectorAll('[data-save]').forEach((btn) => {
      const on = shortlist.has(btn.dataset.save);
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-saved', on);
    });
  };
  shortlist.onChange(syncHearts);

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    // The heart sits inside the card's link — don't follow it.
    e.preventDefault();
    e.stopPropagation();
    shortlist.toggle(btn.dataset.save);
  });

  initViewer({ grid, lookup, shortlist });
  openFromLink(lookup);
}

/** Opens a piece straight away when someone follows a shared link. */
function openFromLink(lookup) {
  const id = new URLSearchParams(location.search).get('piece');
  if (!id || !lookup.has(id)) return;
  const card = document.querySelector(`[data-product="${CSS.escape(id)}"]`);
  if (!card) return;
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: 'auto', block: 'center' });
    card.click();
  });
}

/**
 * Pinch-and-drag zoom for the enlarged photograph.
 *
 * Pointer Events cover mouse, touch and pen in one code path, so a phone gets
 * pinch and a laptop gets the wheel without two separate implementations.
 * Panning is clamped so the picture can never be dragged off the screen.
 */
function createZoom(media, img) {
  if (!media || !img) return { reset() {} };

  const MIN = 1;
  const MAX = 4;
  let scale = 1;
  let x = 0;
  let y = 0;

  const pointers = new Map();
  let startDist = 0;
  let startScale = 1;
  let panFrom = null;

  const apply = () => {
    // Never let the image be dragged past its own edges.
    const box = media.getBoundingClientRect();
    const limitX = Math.max(0, (box.width * scale - box.width) / 2);
    const limitY = Math.max(0, (box.height * scale - box.height) / 2);
    x = Math.min(limitX, Math.max(-limitX, x));
    y = Math.min(limitY, Math.max(-limitY, y));

    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    media.classList.toggle('is-zoomed', scale > 1.01);
  };

  const setScale = (next) => {
    scale = Math.min(MAX, Math.max(MIN, next));
    if (scale === 1) {
      x = 0;
      y = 0;
    }
    apply();
  };

  media.addEventListener('pointerdown', (e) => {
    // Throws if the pointer is not currently active. It must never take the
    // rest of this handler down with it, or panning is silently never armed.
    try {
      media.setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is an optimisation, not a requirement */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      startDist = Math.hypot(a.x - b.x, a.y - b.y);
      startScale = scale;
      panFrom = null;
    } else if (scale > 1.01) {
      panFrom = { x: e.clientX - x, y: e.clientY - y };
    }
  });

  media.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && startDist) {
      const [a, b] = [...pointers.values()];
      setScale(startScale * (Math.hypot(a.x - b.x, a.y - b.y) / startDist));
      return;
    }
    if (panFrom) {
      x = e.clientX - panFrom.x;
      y = e.clientY - panFrom.y;
      apply();
    }
  });

  const release = (e) => {
    try {
      media.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) startDist = 0;
    if (pointers.size === 0) panFrom = null;
  };
  media.addEventListener('pointerup', release);
  media.addEventListener('pointercancel', release);

  // A plain tap or click toggles between fitted and zoomed.
  media.addEventListener('click', (e) => {
    if (panFrom || pointers.size) return;
    // Ignore the click that ends a drag.
    if (Math.abs(x) > 2 || Math.abs(y) > 2) return;
    if (scale > 1.01) {
      setScale(1);
      return;
    }
    const box = media.getBoundingClientRect();
    setScale(2.4);
    // Zoom towards wherever they tapped.
    x = (box.width / 2 - (e.clientX - box.left)) * (2.4 - 1);
    y = (box.height / 2 - (e.clientY - box.top)) * (2.4 - 1);
    apply();
  });

  media.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      setScale(scale * (e.deltaY < 0 ? 1.12 : 0.89));
    },
    { passive: false }
  );

  return {
    reset() {
      scale = 1;
      x = 0;
      y = 0;
      pointers.clear();
      startDist = 0;
      panFrom = null;
      apply();
    },
  };
}

/**
 * The enlarged view. Clicking a piece opens it here rather than jumping straight
 * to WhatsApp — the customer gets a proper look and the full description first,
 * with asking and booking one tap away inside.
 *
 * The card stays a real WhatsApp link underneath, so it still works with
 * JavaScript off and can be opened in a new tab deliberately.
 */
function initViewer({ grid, lookup, shortlist }) {
  const dialog = $('#pieceViewer');
  if (!dialog) return;

  const img = $('#viewerImage');
  const media = $('#viewerMedia');
  const zoom = createZoom(media, img);
  let lastFocus = null;
  let current = null;

  // --- save and share ------------------------------------------------------
  const saveBtn = $('#viewerSave');
  const saveText = $('#viewerSaveText');
  const shareBtn = $('#viewerShare');
  const shareText = $('#viewerShareText');

  const paintSave = () => {
    if (!saveBtn || !current) return;
    const on = shortlist.has(current.id);
    saveBtn.setAttribute('aria-pressed', String(on));
    saveBtn.classList.toggle('is-saved', on);
    saveText.textContent = on ? 'Saved' : 'Save';
  };

  saveBtn?.addEventListener('click', () => {
    if (!current) return;
    shortlist.toggle(current.id);
    paintSave();
  });

  const linkFor = (piece) => {
    const url = new URL(location.href);
    url.search = `?piece=${encodeURIComponent(piece.id)}`;
    url.hash = '';
    return url.toString();
  };

  shareBtn?.addEventListener('click', async () => {
    if (!current) return;
    const url = linkFor(current);

    // The native sheet on a phone, clipboard everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title: current.name, text: current.name, url });
        return;
      } catch {
        /* dismissed — fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      shareText.textContent = 'Link copied';
    } catch {
      shareText.textContent = 'Copy failed';
    }
    setTimeout(() => (shareText.textContent = 'Share'), 2000);
  });

  const open = (piece) => {
    current = piece;
    paintSave();
    if (shareText) shareText.textContent = 'Share';
    $('#viewerCollection').textContent = piece.groupName ?? '';
    $('#viewerName').textContent = piece.name;
    $('#viewerBlurb').textContent = piece.blurb ?? '';

    zoom.reset();
    if (piece.image) {
      img.src = piece.image;
      img.alt = piece.name;
      media.hidden = false;
    } else {
      img.removeAttribute('src');
      media.hidden = true;
    }

    const hint = $('#viewerZoomText');
    if (hint) {
      hint.textContent = window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ? 'Click or scroll to zoom'
        : 'Tap or pinch to zoom';
    }

    // Only the facts the showroom actually recorded.
    const spec = [
      ['Collection', piece.groupName],
      ['Purity', piece.karat],
      ['Finish', piece.finish === 'rose' ? 'Rose gold' : piece.finish === 'yellow' ? 'Yellow gold' : null],
      ['Weight', piece.grams ? `${piece.grams} g` : null],
    ].filter(([, v]) => v);
    $('#viewerSpec').innerHTML = spec
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join('');

    $('#viewerPriceLabel').textContent = piece.priceLabel ?? 'Price on request';
    $('#viewerPriceNote').textContent = piece.priceLabel
      ? 'Includes making and 3% GST, at today’s rate.'
      : 'Weights vary by piece, so we quote each one for you.';

    $('#viewerAsk').href = piece.href;

    lastFocus = document.activeElement;
    dialog.showModal();
  };

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-product]');
    if (!card) return;
    // Let a deliberate new-tab click go straight through to WhatsApp.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const piece = lookup.get(card.dataset.product);
    if (!piece) return;
    e.preventDefault();
    open(piece);
  });

  const close = () => dialog.close();
  $('#viewerClose')?.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // the backdrop
  });
  dialog.addEventListener('close', () => {
    zoom.reset();
    lastFocus?.focus?.();
  });

  $('#viewerVisit')?.addEventListener('click', () => {
    close();
    document.querySelector('#visit')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  });
}

// ---------------------------------------------------------------------------
// Customer words — two rows drifting in opposite directions.
// ---------------------------------------------------------------------------

export async function initVoices() {
  const section = $('#voices');
  if (!section) return;

  let data;
  try {
    data = await api('/api/testimonials');
  } catch {
    return; // section stays hidden
  }

  if (data.hidden || !data.items.length) return;

  const rowA = $('#voicesRowA');
  const rowB = $('#voicesRowB');

  const card = (t) => `
    <figure class="voice">
      <span class="voice__mark" aria-hidden="true">&ldquo;</span>
      <blockquote class="voice__text">${esc(t.text)}</blockquote>
      <figcaption class="voice__who">
        <span class="voice__avatar" aria-hidden="true">${esc((t.name ?? '?').trim().charAt(0).toUpperCase())}</span>
        <span>
          <span class="voice__name">${esc(t.name ?? '')}</span>
          ${t.city ? `<span class="voice__city">${esc(t.city)}</span>` : ''}
        </span>
      </figcaption>
    </figure>`;

  // Split across the two rows, then duplicate each row so the loop is seamless.
  const half = Math.ceil(data.items.length / 2);
  const a = data.items.slice(0, half);
  const b = data.items.slice(half).length ? data.items.slice(half) : data.items.slice(0, half);

  const fill = (row, items) => {
    // Repeat until the track is comfortably wider than the viewport, then
    // duplicate the whole thing once for the wrap-around.
    let set = [...items];
    while (set.length < 6) set = [...set, ...items];
    row.innerHTML = set.map(card).join('') + set.map(card).join('');
    row.style.setProperty('--voice-count', String(set.length));
  };

  fill(rowA, a);
  fill(rowB, b);

  const banner = $('#voicesBanner');
  const bannerText = $('#voicesBannerText');
  if (data.isSample && banner && bannerText) {
    bannerText.textContent =
      'These are placeholder quotes, not real customers. Replace them in data/testimonials.json before the site goes live.';
    banner.hidden = false;
  }

  section.hidden = false;
}

// ---------------------------------------------------------------------------

/**
 * Auspicious buying dates. Stays hidden until the showroom puts real dates in
 * data/muhurat.json — these move every year and a wrong one is worse than none.
 */
export async function initMuhurat() {
  const section = $('#muhurat');
  const list = $('#muhuratList');
  if (!section || !list) return;

  let data;
  try {
    data = await api('/api/muhurat');
  } catch {
    return;
  }
  if (data.empty) return;

  const away = (d) =>
    d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 30 ? `In ${d} days` : `In ${Math.round(d / 30)} months`;

  list.innerHTML = data.items
    .map(
      (m) => `
      <li class="muhurat__item">
        <span class="muhurat__when">${esc(away(m.daysAway))}</span>
        <span class="muhurat__name">${esc(m.name)}</span>
        <span class="muhurat__date">${esc(m.label)} ${esc(String(m.year))}</span>
        ${m.note ? `<span class="muhurat__note">${esc(m.note)}</span>` : ''}
      </li>`
    )
    .join('');

  section.hidden = false;
}

/** Show the footer QR block only for codes that actually exist. */
export function initFooterQr() {
  const block = $('#footerQr');
  if (!block) return;

  let found = 0;
  const figures = Array.from(block.querySelectorAll('.footer__qr-item'));
  let settled = 0;

  const done = () => {
    settled += 1;
    if (settled === figures.length && found > 0) block.hidden = false;
  };

  for (const fig of figures) {
    const img = fig.querySelector('img');
    if (img.complete && img.naturalWidth > 0) {
      found += 1;
      done();
      continue;
    }
    img.addEventListener('load', () => {
      found += 1;
      done();
    });
    img.addEventListener('error', () => {
      fig.remove();
      done();
    });
  }
}
