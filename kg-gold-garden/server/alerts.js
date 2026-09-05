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
 */
import { BUSINESS } from './config.js';
import { readJson, writeJson } from './store.js';
import { send, rateDropEmail } from './mailer.js';

const FILE = 'subscribers.json';

export async function runRateDropAlerts(rates) {
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

    const result = await send({
      to: sub.email,
      ...rateDropEmail({ name: sub.name, target, rates }),
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
  if (value === undefined || value === null || value === '') return { ok: true, value: null };

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Please enter the rate as a number, or leave it blank.' };
  }
  if (n > 1_000_000) {
    return { ok: false, error: 'That looks too high — this is a per-gram rate.' };
  }

  // A figure above today's rate would fire the moment it is saved, which is
  // almost never what someone means by "tell me when it drops".
  const current = Number(rates?.gold22);
  if (Number.isFinite(current) && n >= current) {
    return {
      ok: false,
      error: `22K is ₹${current.toLocaleString('en-IN')} today, so pick a figure below that.`,
    };
  }

  return { ok: true, value: Math.round(n * 100) / 100 };
}

export const alertsMeta = () => ({ from: BUSINESS.email.primary });
