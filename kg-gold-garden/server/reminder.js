/**
 * The daily rate prompt.
 *
 * At 12:00 PM India time, every day, this asks the owners for the day's gold
 * rate. It runs inside the web server, so it fires whether or not anyone has a
 * browser or a terminal open — the server just has to be running.
 *
 * Two delivery paths:
 *
 *   1. ALWAYS — an email to primeplay345@gmail.com containing a tap-to-send
 *      WhatsApp link for each owner, with the request already written. Two taps
 *      from the inbox and the message is on its way from the shop's own number.
 *
 *   2. OPTIONAL — a direct WhatsApp message, if WhatsApp Business credentials
 *      are configured. See the note on templates in sendWhatsApp() below; Meta
 *      does not allow arbitrary business-initiated text.
 */
import { BUSINESS } from './config.js';
import { getRates } from './rates.js';
import { send, rateReminderEmail } from './mailer.js';
import { readJson, writeJson } from './store.js';

const STATE_FILE = 'reminders.json';
const HOUR = 12; // 12:00 PM
const TZ = 'Asia/Kolkata';

const phoneLabel = (p) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

/** "Friday, 5 September 2026" in India time. */
function istDateLabel(d = new Date()) {
  return d.toLocaleDateString('en-IN', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "2026-09-05" in India time — the key we use to avoid firing twice a day. */
function istDateKey(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ }); // en-CA gives ISO order
}

/** Milliseconds until the next 12:00 PM India time. */
export function msUntilNextRun(now = new Date()) {
  // Reading `now` through the IST locale gives a Date whose *local* fields are
  // IST wall-clock. The difference between two such values is timezone-safe.
  const ist = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const target = new Date(ist);
  target.setHours(HOUR, 0, 0, 0);
  if (target <= ist) target.setDate(target.getDate() + 1);
  return target.getTime() - ist.getTime();
}

function buildAsk(owner, dateLabel, adminUrl) {
  const message =
    `Namaste ${owner.name.split(' ')[0]}bhai — daily reminder from the KG Gold Garden website.\n\n` +
    `Please share today's rate (${dateLabel}), per gram:\n` +
    `• 24K / 999 (pure gold)\n` +
    `• 22K / 916\n` +
    `• 18K / 750 — this covers our rose gold as well\n\n` +
    `You can enter them directly here: ${adminUrl}\n` +
    `Or just reply with the three figures and we will put them up.`;
  return `https://wa.me/${owner.intl}?text=${encodeURIComponent(message)}`;
}

/**
 * Direct WhatsApp send via Meta's Cloud API.
 *
 * IMPORTANT: Meta only permits free-form text inside a 24-hour window that the
 * *other* person opened. A business-initiated message like this daily prompt
 * needs a pre-approved message template, so set WHATSAPP_TEMPLATE to its name
 * once you have one approved. Without credentials this returns `skipped` and
 * the email path (which always runs) carries the reminder instead.
 */
async function sendWhatsApp(owner, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { sent: false, reason: 'not_configured' };

  const template = process.env.WHATSAPP_TEMPLATE;
  const payload = template
    ? {
        messaging_product: 'whatsapp',
        to: owner.intl,
        type: 'template',
        template: { name: template, language: { code: 'en' } },
      }
    : {
        messaging_product: 'whatsapp',
        to: owner.intl,
        type: 'text',
        text: { body },
      };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[reminder] WhatsApp send to ${owner.name} failed:`, res.status, detail.slice(0, 300));
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[reminder] WhatsApp request failed:', err.message);
    return { sent: false, reason: 'network' };
  }
}

/** Run the reminder now. Exposed so it can be triggered manually for testing. */
export async function runReminder({ force = false } = {}) {
  const key = istDateKey();
  const state = await readJson(STATE_FILE, { lastRun: null, history: [] });

  if (!force && state.lastRun === key) {
    return { ran: false, reason: 'already_ran_today', date: key };
  }

  const dateLabel = istDateLabel();
  const adminUrl = `${(process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4400}`).replace(/\/$/, '')}/admin`;
  const rates = await getRates();

  const owners = BUSINESS.owners.map((o) => ({
    ...o,
    waLink: buildAsk(o, dateLabel, adminUrl),
  }));

  // 1. Always: the email with tap-to-send links.
  const mail = await send({
    to: BUSINESS.email.primary,
    ...rateReminderEmail({ dateLabel, adminUrl, owners, currentRates: rates }),
  });

  // 2. Optionally: straight to WhatsApp, if credentials exist.
  const whatsapp = [];
  for (const owner of owners) {
    const body =
      `Namaste ${owner.name.split(' ')[0]}bhai — please share today's KG Gold Garden rate ` +
      `(${dateLabel}) per gram: 24K/999, 22K/916 and 18K/750. Enter it here: ${adminUrl}`;
    whatsapp.push({ owner: owner.name, ...(await sendWhatsApp(owner, body)) });
  }

  const record = {
    date: key,
    at: new Date().toISOString(),
    emailDelivered: mail.delivered,
    whatsapp,
    rateWasPlaceholder: rates.isPlaceholder,
  };

  await writeJson(STATE_FILE, {
    lastRun: key,
    history: [...(state.history ?? []).slice(-59), record],
  });

  console.log(
    `[reminder] ${dateLabel} — email ${mail.delivered ? 'sent' : 'queued to outbox'}; ` +
      `whatsapp ${whatsapp.map((w) => `${w.owner}:${w.sent ? 'sent' : w.reason}`).join(', ')}`
  );

  return { ran: true, ...record };
}

/** Schedule the prompt for 12:00 PM IST, every day, for as long as we're up. */
export function startReminderSchedule() {
  const arm = () => {
    const wait = msUntilNextRun();
    const at = new Date(Date.now() + wait);
    console.log(
      `  Rate prompt next at ${at.toLocaleString('en-IN', { timeZone: TZ })} IST ` +
        `(in ${Math.round(wait / 60000)} min)`
    );
    const timer = setTimeout(async () => {
      try {
        await runReminder();
      } catch (err) {
        console.error('[reminder] failed:', err);
      }
      arm(); // re-arm for tomorrow regardless of outcome
    }, wait);
    timer.unref?.();
  };
  arm();
}
