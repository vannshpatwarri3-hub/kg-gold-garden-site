/**
 * A background that springs between tabs, following the cursor on hover and
 * settling back on the selected one.
 *
 * This is the vanilla equivalent of the React `AnimatedBackground` component —
 * same idea, no build step. It uses the Motion library's spring when it is
 * available (window.Motion, the UMD bundle served from /vendor/motion) and falls
 * back to a CSS transition when it is not, so the effect degrades rather than
 * disappears.
 *
 * The pill is measured from the buttons themselves, so it stays correct when the
 * text changes, the row wraps, or the window is resized.
 */
const SPRING = { type: 'spring', bounce: 0.2, duration: 0.3 };

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function animatedTabs(container, { selector = 'button', variant = 'gold' } = {}) {
  if (!container) return null;

  const items = () => Array.from(container.querySelectorAll(selector));
  if (!items().length) return null;

  container.classList.add('has-pill');

  const pill = document.createElement('span');
  pill.className = `tabpill tabpill--${variant}`;
  pill.setAttribute('aria-hidden', 'true');
  container.prepend(pill);

  let shown = false;

  const selected = () =>
    items().find((el) => el.getAttribute('aria-selected') === 'true' || el.classList.contains('is-active')) ??
    null;

  const moveTo = (el, instant = false) => {
    if (!el) {
      pill.style.opacity = '0';
      shown = false;
      return;
    }

    // offsetLeft/Top are relative to the positioned container, which is exactly
    // what the pill is absolutely positioned against.
    const x = el.offsetLeft;
    const y = el.offsetTop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    pill.style.width = `${w}px`;
    pill.style.height = `${h}px`;

    const to = { transform: `translate(${x}px, ${y}px)`, opacity: 1 };

    // The first placement must not animate in from the corner.
    if (instant || !shown || reduced() || !window.Motion?.animate) {
      pill.style.transition = 'none';
      Object.assign(pill.style, to);
      // Force a reflow so the transition we restore does not apply to this move.
      void pill.offsetWidth;
      pill.style.transition = '';
      shown = true;
      return;
    }

    window.Motion.animate(pill, to, SPRING);
    shown = true;
  };

  const settle = () => moveTo(selected());

  container.addEventListener('pointerover', (e) => {
    const el = e.target.closest(selector);
    if (el && container.contains(el)) moveTo(el);
  });

  container.addEventListener('pointerleave', settle);
  container.addEventListener('focusin', (e) => {
    const el = e.target.closest(selector);
    if (el) moveTo(el);
  });
  container.addEventListener('focusout', settle);

  // Selection can change from anywhere — watch the attribute rather than
  // requiring every caller to tell us.
  new MutationObserver(() => settle()).observe(container, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected', 'class'],
  });

  const ro = new ResizeObserver(() => moveTo(selected(), true));
  ro.observe(container);

  // Fonts landing late change button widths under the pill.
  document.fonts?.ready.then(() => moveTo(selected(), true));

  requestAnimationFrame(() => moveTo(selected(), true));

  return { refresh: () => settle() };
}
