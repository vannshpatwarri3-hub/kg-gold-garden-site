/**
 * The page behind the "stop these alerts" link in every alert email.
 *
 * Opening the link does nothing by itself — the visitor has to press the
 * button. Mail security scanners open every link in an email to check it, and
 * a link that unsubscribed on open would quietly unsubscribe people who never
 * asked to stop.
 */
import { $, api } from './lib.js';

const token = new URLSearchParams(location.search).get('t') || '';
const result = $('#result');

if (!/^[a-f0-9]{32}$/.test(token)) {
  $('#nolink').hidden = false;
} else {
  $('#confirm').hidden = false;

  $('#stopBtn').addEventListener('click', async () => {
    const btn = $('#stopBtn');
    btn.classList.add('is-busy');
    btn.disabled = true;
    try {
      const res = await api('/api/stop-alerts', { method: 'POST', body: { token } });
      $('#confirm').hidden = true;
      result.textContent = res.message;
    } catch (err) {
      result.textContent = `That did not work — ${err.message} Please try again in a moment.`;
      btn.classList.remove('is-busy');
      btn.disabled = false;
    }
  });
}
