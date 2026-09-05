import { $, api, esc } from './lib.js';
import { scrollToId } from './scroll.js';

const ICON = {
  whatsapp:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2A9.9 9.9 0 0 0 3.6 17.1L2.05 22l5.05-1.5A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-2 1.37-.51.05-1.16.07-1.87-.12a15.6 15.6 0 0 1-2.5-1.05 12.2 12.2 0 0 1-4.2-4.36c-.3-.5-.75-1.4-.75-2.32s.48-1.4.66-1.6c.18-.2.4-.24.53-.24h.38c.13 0 .3-.03.47.36l.72 1.74c.06.13.1.28.02.44-.09.17-.13.27-.25.42l-.37.43c-.12.12-.25.26-.1.5.13.25.6 1 1.3 1.62.9.8 1.65 1.05 1.9 1.17.24.13.38.11.52-.06l.75-.87c.17-.2.31-.15.52-.08l1.67.79c.24.12.4.18.46.28.06.1.06.6-.19 1.3Z"/></svg>',
  call: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1l-2.23 2.2Z"/></svg>',
  link: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  scroll:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function initChat({ config }) {
  const fab = $('#chatFab');
  const panel = $('#chatPanel');
  const closeBtn = $('#chatClose');
  const log = $('#chatLog');
  const form = $('#chatForm');
  const input = $('#chatInput');
  const chips = $('#chatChips');
  const statusEl = $('#chatStatus');

  if (!fab || !panel) return;

  const history = [];
  let greeted = false;
  let busy = false;

  statusEl.textContent = config.chat?.aiEnabled
    ? 'Ask about rates, timings or a visit'
    : 'Ask about rates, timings or a visit';

  // --- rendering -----------------------------------------------------------
  function bubble(text, who) {
    const el = document.createElement('div');
    el.className = `msg msg--${who}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function actionsFor(el, actions = []) {
    if (!actions.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'msg__actions';

    wrap.innerHTML = actions
      .map((a) => {
        const icon = ICON[a.type] ?? ICON.link;
        const label = esc(a.label);
        const cls = `msg__action${a.type === 'whatsapp' ? ' msg__action--wa' : ''}`;
        const title = a.sublabel ? ` title="${esc(a.sublabel)}"` : '';
        if (a.type === 'scroll') {
          return `<button type="button" class="${cls}" data-scroll="${esc(a.target)}"${title}>${icon}${label}</button>`;
        }
        return `<a class="${cls}" href="${esc(a.href)}" target="_blank" rel="noopener"${title}>${icon}${label}</a>`;
      })
      .join('');

    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scroll]');
      if (!btn) return;
      close();
      scrollToId(btn.dataset.scroll);
    });

    el.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function typing() {
    const el = document.createElement('div');
    el.className = 'msg msg--bot msg--typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    el.setAttribute('aria-label', 'Typing');
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // --- conversation --------------------------------------------------------
  async function send(text) {
    const message = String(text ?? '').trim();
    if (!message || busy) return;

    busy = true;
    chips.classList.add('is-hidden');
    bubble(message, 'user');
    history.push({ role: 'user', text: message });
    input.value = '';

    const dots = typing();
    try {
      const res = await api('/api/chat', { method: 'POST', body: { message, history } });
      dots.remove();
      const el = bubble(res.reply, 'bot');
      actionsFor(el, res.actions);
      history.push({ role: 'bot', text: res.reply });
    } catch (err) {
      dots.remove();
      const el = bubble(
        'I could not reach the shop just now. Please message us on WhatsApp and someone will reply.',
        'bot'
      );
      actionsFor(
        el,
        config.business.owners.map((o) => ({
          type: 'whatsapp',
          label: `WhatsApp ${o.name.split(' ')[0]}`,
          href: o.whatsapp,
        }))
      );
      console.error('[chat]', err);
    } finally {
      busy = false;
    }
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    const el = bubble(
      `Namaste — welcome to ${config.business.name}. Ask me about today's rate, our timings, gold biscuits, or book a visit. I can also put you straight through to Sunilbhai or Anilbhai on WhatsApp.`,
      'bot'
    );
    actionsFor(el, [
      { type: 'scroll', label: "Today's rate", target: '#rate' },
      ...config.business.owners.map((o) => ({
        type: 'whatsapp',
        label: `WhatsApp ${o.name.split(' ')[0]}`,
        sublabel: o.display,
        href: o.whatsapp,
      })),
    ]);
  }

  // --- open / close --------------------------------------------------------
  function open() {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    fab.setAttribute('aria-label', 'Close chat');
    greet();
    setTimeout(() => input.focus(), 60);
  }

  function close() {
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-label', 'Chat with us');
  }

  fab.addEventListener('click', () => (panel.hidden ? open() : close()));
  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      close();
      fab.focus();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value);
  });

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) send(btn.textContent);
  });
}
