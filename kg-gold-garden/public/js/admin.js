import { $, api, inr, esc } from './lib.js';

function status(el, message, kind = '') {
  el.textContent = message;
  el.className = `admin__status${kind ? ` status--${kind}` : ''}`;
}

function busy(btn, on) {
  btn.classList.toggle('is-busy', on);
  btn.disabled = on;
}

// ---------------------------------------------------------------------------
// Which of the three states is this page in?
// ---------------------------------------------------------------------------

function show(state) {
  const authed = state === 'authed';
  $('#loginForm').hidden = state !== 'login';
  $('#setupCard').hidden = state !== 'setup';
  $('#rateForm').hidden = !authed;
  $('#reminderCard').hidden = !authed;
  $('#signOutWrap').hidden = !authed;
}

async function refreshState() {
  try {
    const s = await api('/api/admin/session');
    if (s.authenticated) return show('authed');
    return show(s.passwordConfigured ? 'login' : 'setup');
  } catch {
    show('login');
  }
}

// ---------------------------------------------------------------------------
// Current rates (public — readable whether or not you are logged in)
// ---------------------------------------------------------------------------

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

  for (const key of ['gold24', 'gold22', 'gold18', 'silver']) {
    const input = $(`#${key}`);
    if (input && !input.value && Number.isFinite(rates[key])) input.value = rates[key];
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  const statusEl = $('#loginStatus');
  const username = $('#username').value.trim();
  const password = $('#password').value;

  if (!username) return status(statusEl, 'Please enter the ID.', 'err');
  if (!password) return status(statusEl, 'Please enter the password.', 'err');

  busy(btn, true);
  try {
    await api('/api/admin/login', { method: 'POST', body: { username, password } });
    $('#password').value = '';
    status(statusEl, '');
    await refreshState();
    await paintCurrent();
  } catch (err) {
    status(statusEl, err.message, 'err');
  } finally {
    busy(btn, false);
  }
});

$('#logout').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST', body: {} });
  } catch {
    /* fall through — we re-check state either way */
  }
  await refreshState();
});

// ---------------------------------------------------------------------------
// Publish the rate
// ---------------------------------------------------------------------------

$('#rateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#save');
  const statusEl = $('#status');

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
    await api('/api/rates', { method: 'POST', body });
    status(statusEl, 'Published. The website is now showing today’s rate.', 'ok');
    await paintCurrent();
  } catch (err) {
    status(statusEl, err.message, 'err');
    if (err.data?.needsLogin) await refreshState();
  } finally {
    busy(btn, false);
  }
});

// ---------------------------------------------------------------------------
// Reminder
// ---------------------------------------------------------------------------

$('#runReminder').addEventListener('click', async () => {
  const btn = $('#runReminder');
  const statusEl = $('#reminderStatus');

  busy(btn, true);
  try {
    const res = await api('/api/reminder/run', { method: 'POST', body: { force: true } });
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
    if (err.data?.needsLogin) await refreshState();
  } finally {
    busy(btn, false);
  }
});

// ---------------------------------------------------------------------------

await refreshState();
paintCurrent().catch((err) => status($('#status'), err.message, 'err'));
