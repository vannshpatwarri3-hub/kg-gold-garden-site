import { $, api, inr, esc } from './lib.js';

const TOKEN_KEY = 'kgg.adminToken';

// Convenience only — this is the shop's own device, and the token still has to
// be correct on the server for anything to change.
try {
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) $('#token').value = saved;
} catch {
  /* private mode — the field just starts empty */
}

function status(el, message, kind = '') {
  el.textContent = message;
  el.className = `admin__status${kind ? ` status--${kind}` : ''}`;
}

function busy(btn, on) {
  btn.classList.toggle('is-busy', on);
  btn.disabled = on;
}

async function paintCurrent() {
  const { rates } = await api('/api/rates');

  $('#current').innerHTML = [
    ['24K · 999', rates.gold24],
    ['22K · 916', rates.gold22],
    ['18K · 750 (incl. rose)', rates.gold18],
    ['Silver', rates.silver],
  ]
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${inr(v)} <span class="dim">/g</span></dd></div>`)
    .join('');

  const stamp = $('#stamp');
  if (rates.isPlaceholder) {
    stamp.textContent = 'These are placeholders. The website is showing a warning to visitors.';
    stamp.classList.add('is-placeholder');
  } else {
    const when = new Date(rates.updatedAt);
    stamp.classList.remove('is-placeholder');
    stamp.textContent = `Last updated ${when.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    })}${rates.isStale ? ' — that is over a day ago.' : '.'}`;
  }

  // Pre-fill so a small correction doesn't mean retyping everything.
  for (const key of ['gold24', 'gold22', 'gold18', 'silver']) {
    const input = $(`#${key}`);
    if (input && !input.value && Number.isFinite(rates[key])) input.value = rates[key];
  }
}

$('#rateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#save');
  const statusEl = $('#status');
  const token = $('#token').value.trim();

  if (!token) return status(statusEl, 'Enter the admin token first.', 'err');

  const body = {};
  for (const key of ['gold24', 'gold22', 'gold18', 'silver']) {
    const v = $(`#${key}`).value.trim();
    if (v) body[key] = Number(v);
  }

  if (!body.gold24 || !body.gold22) {
    return status(statusEl, 'The 24K and 22K rates are both required.', 'err');
  }

  busy(btn, true);
  try {
    await api('/api/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body,
    });
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
    status(statusEl, 'Published. The website is now showing today’s rate.', 'ok');
    await paintCurrent();
  } catch (err) {
    status(statusEl, err.message, 'err');
  } finally {
    busy(btn, false);
  }
});

$('#runReminder').addEventListener('click', async () => {
  const btn = $('#runReminder');
  const statusEl = $('#reminderStatus');
  const token = $('#token').value.trim();
  if (!token) return status(statusEl, 'Enter the admin token first.', 'err');

  busy(btn, true);
  try {
    const res = await api('/api/reminder/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: { force: true },
    });
    const wa = (res.whatsapp ?? [])
      .map((w) => `${w.owner}: ${w.sent ? 'sent' : w.reason.replace(/_/g, ' ')}`)
      .join(' · ');
    status(
      statusEl,
      res.emailDelivered
        ? `Reminder emailed to the shop with tap-to-send links. WhatsApp — ${wa}`
        : `Email delivery is not switched on, so the reminder was saved to data/outbox/. WhatsApp — ${wa}`,
      res.emailDelivered ? 'ok' : 'warn'
    );
  } catch (err) {
    status(statusEl, err.message, 'err');
  } finally {
    busy(btn, false);
  }
});

paintCurrent().catch((err) => status($('#status'), err.message, 'err'));
