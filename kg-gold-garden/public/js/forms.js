import { $, api, esc } from './lib.js';

const iso = (d) => d.toISOString().slice(0, 10);

function setBusy(btn, busy) {
  btn.classList.toggle('is-busy', busy);
  btn.disabled = busy;
}

function clearErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field__error').forEach((e) => (e.textContent = ''));
}

function showErrors(form, errors) {
  let first = null;
  for (const [key, message] of Object.entries(errors ?? {})) {
    const slot = form.querySelector(`[data-error-for="${key}"]`);
    if (!slot) continue;
    slot.textContent = message;
    slot.closest('.field')?.classList.add('has-error');
    first = first ?? form.querySelector(`[name="${key}"]`);
  }
  first?.focus();
}

function status(el, message, kind = '') {
  el.textContent = message;
  el.className = `${el.classList.contains('alerts__status') ? 'alerts__status' : 'appt__status'}${
    kind ? ` status--${kind}` : ''
  }`;
}

// ---------------------------------------------------------------------------
// Appointment booking
// ---------------------------------------------------------------------------

export function initAppointment({ config }) {
  const form = $('#apptForm');
  if (!form) return;

  const dateInput = $('#apptDate');
  const timeSel = $('#apptTime');
  const submit = $('#apptSubmit');
  const statusEl = $('#apptStatus');

  const today = new Date();
  const max = new Date();
  max.setDate(max.getDate() + 60);
  dateInput.min = iso(today);
  dateInput.max = iso(max);

  async function loadSlots() {
    const date = dateInput.value;
    clearErrors(form);
    if (!date) {
      timeSel.innerHTML = '<option value="">Pick a date first</option>';
      return;
    }

    timeSel.disabled = true;
    timeSel.innerHTML = '<option value="">Checking availability…</option>';

    try {
      const data = await api(`/api/slots?date=${encodeURIComponent(date)}`);

      if (!data.open) {
        const why =
          data.reason === 'closed'
            ? `${config.business.hours.closedLabel} — please pick another day.`
            : 'Please choose a date within the next 60 days.';
        timeSel.innerHTML = '<option value="">Not available</option>';
        showErrors(form, { date: why });
        return;
      }

      const open = data.slots.filter((s) => s.available);
      if (!open.length) {
        timeSel.innerHTML = '<option value="">Fully booked</option>';
        showErrors(form, { date: 'Every slot that day is taken. Please try another date.' });
        return;
      }

      timeSel.innerHTML =
        '<option value="">Choose a time</option>' +
        data.slots
          .map(
            (s) =>
              `<option value="${esc(s.value)}"${s.available ? '' : ' disabled'}>${esc(s.label)}${
                s.available ? '' : ' — taken'
              }</option>`
          )
          .join('');
    } catch (err) {
      timeSel.innerHTML = '<option value="">Could not load times</option>';
      status(statusEl, err.message, 'err');
    } finally {
      timeSel.disabled = false;
    }
  }

  dateInput.addEventListener('change', loadSlots);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    status(statusEl, '');

    const body = Object.fromEntries(new FormData(form).entries());

    // Cheap client-side checks so the obvious mistakes never cost a round trip.
    const local = {};
    if (!String(body.name ?? '').trim()) local.name = 'Please enter your name.';
    if (!/^[6-9]\d{9}$/.test(String(body.phone ?? '').replace(/\D/g, '').slice(-10)))
      local.phone = 'Please enter a valid 10-digit Indian mobile number.';
    if (!body.date) local.date = 'Please choose a date.';
    if (!body.time) local.time = 'Please choose a time.';
    if (Object.keys(local).length) return showErrors(form, local);

    setBusy(submit, true);
    try {
      const res = await api('/api/appointments', { method: 'POST', body });

      form.hidden = true;
      const receipt = document.createElement('div');
      receipt.className = 'appt__receipt';
      receipt.setAttribute('role', 'status');

      // The slot is already booked by the time this runs; the email leaves a
      // moment later. Only promise an inbox note if delivery is actually set up.
      const mailLine = !body.email
        ? 'Please keep your reference number handy.'
        : res.mailConfigured
          ? 'A confirmation is on its way to your inbox.'
          : 'Our email delivery is not switched on yet, so your confirmation is saved and will be sent shortly. Your slot is booked either way.';

      receipt.innerHTML = `
        <h4>Your appointment is confirmed</h4>
        <dl>
          <div><dt>Reference</dt><dd>${esc(res.reference)}</dd></div>
          <div><dt>Date</dt><dd>${esc(res.date)}</dd></div>
          <div><dt>Time</dt><dd>${esc(res.time)}</dd></div>
        </dl>
        <p style="margin-top:14px;color:var(--muted);font-size:var(--step--1)">${esc(mailLine)}</p>
        <a class="btn btn--outline" style="margin-top:16px" href="${esc(res.whatsapp)}" target="_blank" rel="noopener">
          Send us a WhatsApp note
        </a>`;
      form.parentElement.appendChild(receipt);
      receipt.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      if (err.data?.errors) showErrors(form, err.data.errors);
      else status(statusEl, err.message, 'err');
      if (err.status === 409) loadSlots();
    } finally {
      setBusy(submit, false);
    }
  });
}

// ---------------------------------------------------------------------------
// Rate-alert subscription
// ---------------------------------------------------------------------------

export function initSubscribe() {
  const form = $('#subForm');
  if (!form) return;

  const submit = $('#subSubmit');
  const statusEl = $('#subStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    status(statusEl, '');

    const body = Object.fromEntries(new FormData(form).entries());
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(body.email ?? ''))) {
      return showErrors(form, { email: 'Please enter a valid email address.' });
    }
    // An empty box means "no alert", not "alert me at zero".
    if (!String(body.alertBelow ?? '').trim()) delete body.alertBelow;

    setBusy(submit, true);
    try {
      const res = await api('/api/subscribe', { method: 'POST', body });
      // "Saved" and "emailed" are different claims — say which one happened.
      status(statusEl, res.message, res.mailConfigured || res.alreadySubscribed ? 'ok' : 'warn');
      if (!res.alreadySubscribed) form.reset();
    } catch (err) {
      if (err.data?.errors) showErrors(form, err.data.errors);
      else status(statusEl, err.message, 'err');
    } finally {
      setBusy(submit, false);
    }
  });
}
