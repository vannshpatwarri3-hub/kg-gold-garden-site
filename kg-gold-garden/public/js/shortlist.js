/**
 * The shortlist.
 *
 * A bride looks at nine necklaces, not one. Saving them and sending the lot in a
 * single WhatsApp message is far better for both sides than nine separate
 * enquiries the owner then has to piece together.
 *
 * Kept in localStorage, so it survives a reload and needs no account. Every read
 * is wrapped — private mode and blocked site data both make it throw.
 */
import { $, esc } from './lib.js';

const KEY = 'kgg.shortlist';

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const write = (ids) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* the list still works for this visit, it just will not be remembered */
  }
};

export function initShortlist({ lookup, config }) {
  const fab = $('#shortlistFab');
  const panel = $('#shortlistPanel');
  const countEl = $('#shortlistCount');
  const itemsEl = $('#shortlistItems');
  const emptyEl = $('#shortlistEmpty');
  const actionsEl = $('#shortlistActions');
  const sendEl = $('#shortlistSend');

  if (!fab || !panel) return { has: () => false, toggle() {}, onChange() {} };

  const owner = config.business.owners[0];
  const listeners = new Set();

  // Drop anything that has since left the catalogue.
  let ids = read().filter((id) => lookup.has(id));
  write(ids);

  const has = (id) => ids.includes(id);

  const message = () => {
    const lines = [`Hello ${config.business.name}, I have shortlisted these from your website:`, ''];
    ids.forEach((id, i) => {
      const p = lookup.get(id);
      if (!p) return;
      const bits = [p.groupName, p.karat, p.grams ? `${p.grams} g` : null].filter(Boolean).join(' · ');
      lines.push(`${i + 1}. ${p.name}${bits ? ` — ${bits}` : ''}${p.priceLabel ? ` — ${p.priceLabel}` : ''}`);
    });
    lines.push('', 'Could you tell me the prices, and can I book a time to come and see them?');
    return lines.join('\n');
  };

  const render = () => {
    countEl.textContent = String(ids.length);
    fab.hidden = ids.length === 0;

    const rows = ids
      .map((id) => {
        const p = lookup.get(id);
        if (!p) return '';
        return `
          <li class="shortlist__item">
            ${
              p.image
                ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
                : '<span class="shortlist__thumb"></span>'
            }
            <span class="shortlist__meta">
              <span class="shortlist__name">${esc(p.name)}</span>
              <span class="shortlist__sub">${esc(p.groupName ?? '')}${
                p.priceLabel ? ` &middot; ${esc(p.priceLabel)}` : ' &middot; Price on request'
              }</span>
            </span>
            <button type="button" class="shortlist__remove" data-remove="${esc(id)}"
                    aria-label="Remove ${esc(p.name)} from the shortlist">
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </li>`;
      })
      .join('');

    itemsEl.innerHTML = rows;
    emptyEl.hidden = ids.length > 0;
    actionsEl.hidden = ids.length === 0;
    sendEl.href = `https://wa.me/91${owner.waPhone ?? owner.phone}?text=${encodeURIComponent(message())}`;

    listeners.forEach((fn) => fn(ids));
  };

  const toggle = (id) => {
    ids = has(id) ? ids.filter((x) => x !== id) : [...ids, id];
    write(ids);
    render();
    return has(id);
  };

  fab.addEventListener('click', () => {
    panel.showModal();
    fab.setAttribute('aria-expanded', 'true');
  });

  const close = () => {
    panel.close();
    fab.setAttribute('aria-expanded', 'false');
  };
  $('#shortlistClose')?.addEventListener('click', close);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) close();
  });
  panel.addEventListener('close', () => fab.setAttribute('aria-expanded', 'false'));

  itemsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) toggle(btn.dataset.remove);
  });

  $('#shortlistClear')?.addEventListener('click', () => {
    ids = [];
    write(ids);
    render();
    close();
  });

  render();

  return {
    has,
    toggle,
    onChange(fn) {
      listeners.add(fn);
      fn(ids);
    },
  };
}
