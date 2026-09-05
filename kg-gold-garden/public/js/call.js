/**
 * Makes "Call" actually do something.
 *
 * On a phone a `tel:` link opens the dialler and everything is fine. On a laptop
 * it usually does nothing at all, which is what made the call buttons feel
 * broken. So on pointer devices we intercept and show a chooser instead: both
 * owners, with dial / WhatsApp / copy-number for each.
 */
import { $, esc } from './lib.js';

/** True on a device that almost certainly cannot place a call. */
const isDesktop = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function initCallSheet({ config }) {
  const sheet = $('#callSheet');
  const list = $('#callSheetList');
  if (!sheet || !list) return;

  list.innerHTML = config.business.owners
    .map(
      (o) => `
      <li class="callsheet__owner">
        <div class="callsheet__who">
          <span class="callsheet__name">${esc(o.name)}</span>
          <a class="callsheet__number" href="${esc(o.tel)}">${esc(o.display)}</a>
        </div>
        <div class="callsheet__actions">
          <a class="callsheet__btn callsheet__btn--call" href="${esc(o.tel)}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1l-2.23 2.2Z"/></svg>
            Call
          </a>
          <a class="callsheet__btn callsheet__btn--wa" href="${esc(o.whatsapp)}" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2A9.9 9.9 0 0 0 3.6 17.1L2.05 22l5.05-1.5A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-2 1.37-.51.05-1.16.07-1.87-.12a15.6 15.6 0 0 1-2.5-1.05 12.2 12.2 0 0 1-4.2-4.36c-.3-.5-.75-1.4-.75-2.32s.48-1.4.66-1.6c.18-.2.4-.24.53-.24h.38c.13 0 .3-.03.47.36l.72 1.74c.06.13.1.28.02.44-.09.17-.13.27-.25.42l-.37.43c-.12.12-.25.26-.1.5.13.25.6 1 1.3 1.62.9.8 1.65 1.05 1.9 1.17.24.13.38.11.52-.06l.75-.87c.17-.2.31-.15.52-.08l1.67.79c.24.12.4.18.46.28.06.1.06.6-.19 1.3Z"/></svg>
            WhatsApp
          </a>
          <button type="button" class="callsheet__btn callsheet__btn--copy" data-copy="+91${esc(o.phone)}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
            <span>Copy</span>
          </button>
        </div>
      </li>`
    )
    .join('');

  // --- copy to clipboard ---------------------------------------------------
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const label = btn.querySelector('span');
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add('is-copied');
      label.textContent = 'Copied';
    } catch {
      // Clipboard blocked (insecure origin, or permission denied) — select the
      // number instead so the visitor can copy it by hand.
      label.textContent = 'Select it';
      const numberEl = btn.closest('.callsheet__owner')?.querySelector('.callsheet__number');
      if (numberEl) {
        const range = document.createRange();
        range.selectNodeContents(numberEl);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    setTimeout(() => {
      btn.classList.remove('is-copied');
      label.textContent = 'Copy';
    }, 2000);
  });

  const open = () => {
    if (!sheet.open) sheet.showModal();
  };
  const close = () => sheet.close();

  $('#callSheetClose')?.addEventListener('click', close);

  // Clicking the backdrop (i.e. the dialog element itself) closes it.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });

  /**
   * Intercept every tel: link on a device that cannot dial. Mobile is left
   * completely alone so the dialler still opens on one tap.
   */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="tel:"], [data-call-trigger]');
    if (!link) return;
    if (sheet.contains(link)) return; // inside the sheet, let it through
    if (!isDesktop() && link.matches('a[href^="tel:"]')) return;

    e.preventDefault();
    open();
  });

  return { open, close };
}
