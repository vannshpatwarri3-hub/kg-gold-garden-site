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
  $('#bookingsCard').hidden = !authed;
  $('#subscribersCard').hidden = !authed;
  $('#signOutWrap').hidden = !authed;
}

async function refreshState() {
  try {
    const s = await api('/api/admin/session');
    if (s.authenticated) {
      show('authed');
      // Customer records only ever load for someone who is actually logged in.
      paintData().catch(() => {});
      return;
    }
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
// What the website has collected. Owners only — the endpoint behind this is
// locked, and none of it is ever rendered into a public page.
// ---------------------------------------------------------------------------

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const stampLabel = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

function bookingRow(b) {
  let tag = '<span class="tag tag--ok">confirmed</span>';
  if (b.status === 'cancelled') tag = '<span class="tag tag--off">cancelled</span>';
  else if (b.isToday) tag = '<span class="tag tag--now">today</span>';
  else if (b.isPast) tag = '<span class="tag tag--past">past</span>';

  const contact = [
    `<a href="tel:+91${esc(b.phone)}">+91 ${esc(b.phone)}</a>`,
    b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : null,
  ]
    .filter(Boolean)
    .join(' &middot; ');

  return `
    <article class="record">
      <div class="record__head"><strong>${esc(b.name)}</strong>${tag}</div>
      <p class="record__when">${esc(dayLabel(b.date))} at ${esc(b.timeLabel ?? b.time)}${
        b.purpose ? ` &middot; ${esc(b.purpose)}` : ''
      }</p>
      <p class="record__contact">${contact}</p>
      ${b.notes ? `<p class="record__notes">${esc(b.notes)}</p>` : ''}
      <p class="record__meta">${esc(b.reference)} &middot; booked ${esc(stampLabel(b.createdAt))}</p>
    </article>`;
}

function subscriberRow(s) {
  const tag = s.alertBelow
    ? `<span class="tag tag--ok">alert below ${inr(s.alertBelow)}</span>`
    : '<span class="tag tag--past">daily rates only</span>';

  return `
    <article class="record">
      <div class="record__head"><strong>${esc(s.name || 'No name given')}</strong>${tag}</div>
      <p class="record__contact"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>
      <p class="record__meta">Joined ${esc(stampLabel(s.subscribedAt))}</p>
    </article>`;
}

async function paintData() {
  const btn = $('#refreshData');
  busy(btn, true);
  try {
    const d = await api('/api/admin/data');
    const c = d.counts;

    $('#bookingsSummary').textContent =
      c.appointments === 0
        ? 'Nobody has asked for a viewing yet.'
        : `${c.appointments} in total · ${c.upcoming} still to come · ${c.today} today.`;
    $('#bookings').innerHTML =
      d.appointments.map(bookingRow).join('') || '<p class="records__empty">Nothing here yet.</p>';

    $('#subscribersSummary').textContent =
      c.subscribers === 0
        ? 'Nobody has signed up for rate alerts yet.'
        : `${c.subscribers} on the list · ${c.alerts} waiting for a price to be reached.`;
    $('#subscribers').innerHTML =
      d.subscribers.map(subscriberRow).join('') || '<p class="records__empty">Nothing here yet.</p>';
  } catch (err) {
    $('#bookingsSummary').textContent = err.message;
    if (err.data?.needsLogin) await refreshState();
  } finally {
    busy(btn, false);
  }
}

$('#refreshData').addEventListener('click', () => paintData());

// ---------------------------------------------------------------------------

await refreshState();
paintCurrent().catch((err) => status($('#status'), err.message, 'err'));
