import { $, $$, api, esc } from './lib.js';
import { initReveal, initNav, initAnchors } from './scroll.js';
import { initHeroBackground, attachVideoUpgrade } from './hero-bg.js';
import { initRates, initCalculator, initBullion } from './calculator.js';
import { initAppointment, initSubscribe } from './forms.js';
import { initChat } from './chat.js';

const ASSURANCE_ICON = {
  bis: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6 4.2 5.9v5.4c0 4.7 3.3 9.1 7.8 10.2 4.5-1.1 7.8-5.5 7.8-10.2V5.9L12 2.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m8.8 12 2.2 2.3 4.2-4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  purity:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 21 8v8l-9 5.2L3 16V8l9-5.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 7.4 16.6 10v4.6L12 17.2 7.4 14.6V10L12 7.4Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};

function renderOwners(config) {
  const html = config.business.owners
    .map(
      (o) => `
      <div class="owner-line">
        <a href="${esc(o.tel)}">${esc(o.name)} — ${esc(o.display)}</a>
        <a class="owner-line__wa" href="${esc(o.whatsapp)}" target="_blank" rel="noopener"
           aria-label="WhatsApp ${esc(o.name)}">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2A9.9 9.9 0 0 0 3.6 17.1L2.05 22l5.05-1.5A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-2 1.37-.51.05-1.16.07-1.87-.12a15.6 15.6 0 0 1-2.5-1.05 12.2 12.2 0 0 1-4.2-4.36c-.3-.5-.75-1.4-.75-2.32s.48-1.4.66-1.6c.18-.2.4-.24.53-.24h.38c.13 0 .3-.03.47.36l.72 1.74c.06.13.1.28.02.44-.09.17-.13.27-.25.42l-.37.43c-.12.12-.25.26-.1.5.13.25.6 1 1.3 1.62.9.8 1.65 1.05 1.9 1.17.24.13.38.11.52-.06l.75-.87c.17-.2.31-.15.52-.08l1.67.79c.24.12.4.18.46.28.06.1.06.6-.19 1.3Z"/></svg>
          WhatsApp
        </a>
      </div>`
    )
    .join('');

  const owners = $('#visitOwners');
  if (owners) owners.innerHTML = html;

  const footer = $('#footerContact');
  if (footer) {
    footer.innerHTML = `
      <p>${esc(config.business.address.line1)}<br>${esc(config.business.address.line2)}<br>
         ${esc(config.business.address.area)}, ${esc(config.business.address.city)} ${esc(config.business.address.pincode)}</p>
      ${config.business.owners
        .map((o) => `<p><a href="${esc(o.tel)}">${esc(o.name)} — ${esc(o.display)}</a></p>`)
        .join('')}
      <p><a href="mailto:${esc(config.business.email)}">${esc(config.business.email)}</a></p>
      ${
        config.business.social?.instagram
          ? `<p><a href="${esc(config.business.social.instagram.url)}" target="_blank" rel="noopener">
               Instagram — @${esc(config.business.social.instagram.handle)}</a></p>`
          : ''
      }`;
  }
}

function renderAssurances(config) {
  const list = $('#assuranceList');
  if (!list) return;
  list.innerHTML = config.business.assurances
    .map(
      (a) => `
      <li class="assurance__item">
        <span class="assurance__icon" aria-hidden="true">${ASSURANCE_ICON[a.key] ?? ASSURANCE_ICON.purity}</span>
        <div>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.body)}</p>
        </div>
      </li>`
    )
    .join('');
}

async function initShowcaseSection(configPromise) {
  const canvas = $('#showcaseCanvas');
  if (!canvas) return;

  const loading = $('#showcaseLoading');
  const nameEl = $('#showcaseName');
  const copyEl = $('#showcaseCopy');
  const specEl = $('#showcaseSpec');
  const tabs = $$('.showcase__tabs button');
  const finishGroup = $('#showcaseFinish');
  const finishNote = $('#showcaseFinishNote');
  const finishBtns = $$('#showcaseFinish button');

  let viewer = null;
  let PIECES = {};
  let finishes = [];

  const paint = (key) => {
    const p = PIECES[key];
    if (!p) return;
    nameEl.textContent = p.name;
    copyEl.textContent = p.copy;
    specEl.innerHTML = p.spec
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join('');

    // 24K has no alloy in it, so the biscuit and the coin have no rose variant.
    const allowed = p.supportsFinish !== false;
    finishGroup?.classList.toggle('is-disabled', !allowed);
    finishBtns.forEach((b) => (b.disabled = !allowed));
    if (finishNote) {
      finishNote.textContent = allowed
        ? (finishes.find((f) => f.id === activeFinish())?.note ?? '')
        : 'Pure 24K gold has no alloy in it, so this is made in yellow only.';
    }
    if (!allowed) applyFinish('yellow', { silent: true });
  };

  const activeFinish = () =>
    finishBtns.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.finish ?? 'yellow';

  function applyFinish(id, { silent = false } = {}) {
    const finish = finishes.find((f) => f.id === id);
    finishBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.finish === id)));
    viewer?.setFinish(finish?.hex ?? '#FFC85C');
    if (!silent && finishNote && finish) finishNote.textContent = finish.note;
  }

  try {
    // Loaded on demand so a visitor who never scrolls here pays nothing for it.
    const mod = await import('./showcase.js');
    PIECES = mod.PIECES;
    viewer = mod.initShowcase(canvas, { onReady: () => loading?.classList.add('is-done') });
  } catch (err) {
    console.error('[showcase] 3D unavailable:', err);
  }

  if (!viewer) {
    // No WebGL: hide the stage rather than leave an empty box, keep the copy.
    loading?.classList.add('is-done');
    canvas.closest('.showcase__stage')?.style.setProperty('display', 'none');
  }

  try {
    finishes = (await configPromise).finishes ?? [];
  } catch {
    finishes = []; // the 3D still works; the finish note just stays empty
  }

  paint('bar');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      viewer?.setPiece(tab.dataset.piece);
      paint(tab.dataset.piece);
    });
  });

  finishBtns.forEach((btn) => {
    btn.addEventListener('click', () => applyFinish(btn.dataset.finish));
  });
}

async function boot() {
  // Chrome-free things that never depend on the network.
  initReveal();
  initNav();
  initAnchors();
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  initHeroBackground($('#heroCanvas'));
  attachVideoUpgrade($('#heroVideo'));

  // Kick the fetch off once and share it — the 3D section needs the finishes.
  const configPromise = api('/api/config');
  initShowcaseSection(configPromise);

  let config, rates;
  try {
    [config, rates] = await Promise.all([
      configPromise,
      api('/api/rates').then((r) => r.rates),
    ]);
  } catch (err) {
    console.error('[boot] could not load shop data:', err);
    const stamp = $('#rateStamp');
    if (stamp) stamp.textContent = 'Could not load today’s rate. Please call or WhatsApp us.';
    return; // The page still shows the address, hours and phone numbers.
  }

  const mapsLink = $('#mapsLink');
  if (mapsLink) mapsLink.href = config.business.mapsUrl;

  renderOwners(config);
  renderAssurances(config);

  initRates({ config, rates });
  initCalculator({ config, rates });
  initBullion({ config, rates });
  initAppointment({ config });
  initSubscribe();
  initChat({ config });

  // Filling the calculator and the bullion grid changes the height of the page
  // above wherever a deep link pointed, so re-settle on the target once.
  if (location.hash.length > 1) {
    requestAnimationFrame(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }
}

boot();
