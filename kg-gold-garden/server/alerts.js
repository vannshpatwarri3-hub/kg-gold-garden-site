/**
 * Rate-drop alerts.
 *
 * A subscriber may name a price they are waiting for — "tell me when 22K falls
 * below ₹14,000". Every time the showroom publishes a rate, anyone whose figure
 * has been reached is emailed once.
 *
 * "Once" matters: the flag is set when we write to them and cleared only when
 * the rate climbs back above their figure, so a week of low rates sends one
 * email rather than seven.
 *
 * Every alert carries a link that stops them. The link holds a random token and
 * nothing else — never the email address, which would otherwise end up in
 * server logs, browser history and every link-scanner that reads the email.
 */
import crypto from 'node:crypto';
import { BUSINESS } from './config.js';
import { readJson, writeJson } from './store.js';
import { send, rateDropEmail } from './mailer.js';

const FILE = 'subscribers.json';

export const newStopToken = () => crypto.randomBytes(16).toString('hex');

export function stopUrlFor(origin, sub) {
  const base = (origin || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/stop-alerts?t=${sub.stopToken}`;
}

/** Turn a subscriber's alerts off, given the token from their email. */
export async function stopAlerts(token) {
  const given = Buffer.from(String(token ?? ''));
  if (given.length !== 32) return { stopped: false };

  const list = await readJson(FILE, []);
  const sub = list.find((s) => {
    const mine = Buffer.from(String(s.stopToken ?? ''));
    return mine.length === given.length && crypto.timingSafeEqual(mine, given);
  });
  if (!sub) return { stopped: false };

  if (sub.status !== 'stopped') {
    sub.status = 'stopped';
    sub.stoppedAt = new Date().toISOString();
    await writeJson(FILE, list);
  }
  return { stopped: true };
}

export async function runRateDropAlerts(rates, origin) {
  const list = await readJson(FILE, []);
  if (!list.length) return { checked: 0, sent: 0 };

  const current = Number(rates?.gold22);
  if (!Number.isFinite(current)) return { checked: 0, sent: 0 };

  let sent = 0;
  let changed = false;

  for (const sub of list) {
    const target = Number(sub.alertBelow);
    if (sub.status !== 'active' || !Number.isFinite(target) || target <= 0) continue;

    if (current > target) {
      // Back above their figure — arm it again for next time.
      if (sub.alertedAt) {
        sub.alertedAt = null;
        changed = true;
      }
      continue;
    }

    if (sub.alertedAt) continue; // already told them about this dip

    // Sign-ups from before stop links existed get a token on their first alert,
    // so no alert ever goes out without a working way to stop the next one.
    if (!sub.stopToken) {
      sub.stopToken = newStopToken();
      changed = true;
    }

    const result = await send({
      to: sub.email,
      ...rateDropEmail({ name: sub.name, target, rates, stopUrl: stopUrlFor(origin, sub) }),
    });

    sub.alertedAt = new Date().toISOString();
    sub.alertDelivered = result.delivered;
    changed = true;
    if (result.delivered) sent += 1;
  }

  if (changed) await writeJson(FILE, list);

  if (sent) {
    console.log(`[alerts] 22K reached ₹${current} — ${sent} rate-drop email(s) sent`);
  }
  return { checked: list.length, sent };
}

/** Used by the signup form to sanity-check the figure someone types. */
export function validateAlertBelow(value, rates) {
  // The price is the whole point of signing up: without one, nothing is ever
  // sent after the welcome note.
  if (value === undefined || value === null || value === '') {
    return { ok: false, error: 'Please enter the 22K price you want to hear about.' };
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Please enter the price as a number, in rupees per gram.' };
  }
  if (n > 1_000_000) {
    return { ok: false, error: 'That looks too high — this is a per-gram rate.' };
  }

  // A figure above today's rate would fire the moment it is saved, which is
  // almost never what someone means by "tell me when it drops". Only checked
  // against a REAL rate: while the placeholder is up its figure is not today's
  // price, so quoting it would state a made-up number as fact — and turn away
  // a perfectly good alert.
  const current = Number(rates?.gold22);
  if (!rates?.isPlaceholder && Number.isFinite(current) && n >= current) {
    return {
      ok: false,
      error: `22K is ₹${current.toLocaleString('en-IN')} today, so pick a figure below that.`,
    };
  }

  return { ok: true, value: Math.round(n * 100) / 100 };
}

export const alertsMeta = () => ({ from: BUSINESS.email.primary });
