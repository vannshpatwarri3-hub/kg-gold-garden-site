import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS, CATEGORIES, PURITY, BULLION, FINISHES } from './config.js';
import { startReminderSchedule, runReminder } from './reminder.js';
import { getProducts, getTestimonials, getMuhurat } from './catalogue.js';
import { runRateDropAlerts, validateAlertBelow } from './alerts.js';
import {
  COOKIE,
  createSession,
  isPasswordConfigured,
  parseCookies,
  sessionCookie,
  verifyPassword,
  verifySession,
  verifyUsername,
} from './auth.js';
import { ensureDirs, readJson, writeJson, append } from './store.js';
import { getRates, setRates, computePrice } from './rates.js';
import { reply as chatReply, chatMeta, whatsappLink } from './chat.js';
import { llmsTxt } from './llms.js';
import { PAGES, isServicePage, renderPage } from './pages.js';
import {
  send,
  isMailConfigured,
  welcomeEmail,
  appointmentEmail,
  ownerAppointmentNotice,
  ownerSubscriberNotice,
} from './mailer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const PORT = process.env.PORT || 4400;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(16).toString('hex');
const ADMIN_TOKEN_GENERATED = !process.env.ADMIN_TOKEN;

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

/**
 * The page carries an inline JSON-LD block for search engines, which a strict
 * `script-src 'self'` would block. Rather than weaken the policy with
 * 'unsafe-inline', hash the block at startup so edits to it keep working.
 */
const inlineScriptHashes = await (async () => {
  try {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(path.join(ROOT, 'public', 'index.html'), 'utf8');
    return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
      (m) => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`
    );
  } catch {
    return [];
  }
})();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // frame-ancestors below is what modern browsers obey; this is the older
  // header, kept for the phones and tablets that predate CSP level 2.
  res.setHeader('X-Frame-Options', 'DENY');

  // The site asks for none of these, so refuse them outright: a script that
  // somehow got in still could not reach a camera, a microphone or a location.
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );

  // Render terminates TLS at its edge, so the app only learns the visitor's
  // real scheme from this header. Only promise HSTS when the request genuinely
  // arrived over HTTPS — sending it on plain http (or on localhost) would pin a
  // browser to a scheme the server is not actually serving.
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  if (proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      ["script-src 'self'", ...inlineScriptHashes].join(' '),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      // Nothing here embeds Flash, Java or a PDF viewer, and every form on the
      // site posts to this origin. Saying so closes two more injection routes.
      "object-src 'none'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
});

/**
 * Nothing under /api/ may be cached.
 *
 * Without an explicit instruction a browser is free to guess how long a
 * response stays good, and Safari in particular guesses generously. That is how
 * a phone ends up showing yesterday's gold rate — or the "not set yet" notice —
 * hours after the counter has entered today's, while a laptop that happened to
 * fetch later shows the right one. For a shop whose whole page turns on a
 * number that changes daily, a stale answer is worse than a slow one.
 *
 * The images and stylesheets below are still cached normally; this covers only
 * the endpoints that report changing state.
 */
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache'); // for HTTP/1.0 caches on older devices
  res.setHeader('Expires', '0');
  next();
});

// --- simple in-memory rate limiting ----------------------------------------
const buckets = new Map();
function limit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      // Say how long, rather than leaving someone guessing when to retry.
      const waitMs = windowMs - (now - Math.min(...hits));
      const mins = Math.ceil(waitMs / 60000);
      return res.status(429).json({
        ok: false,
        error: `Too many attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`,
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

/** Forget a visitor's attempts — called once they prove who they are. */
const clearLimit = (name, req) => buckets.delete(`${name}:${req.ip}`);
setInterval(() => buckets.clear(), 15 * 60e3).unref();

// --- admin auth -------------------------------------------------------------

/**
 * Two ways in: the session cookie set by logging in with the password, or the
 * ADMIN_TOKEN header (kept so scripts and cron jobs still work). If a password
 * has been configured, that is the route a human should use.
 */
function isAdmin(req) {
  if (verifySession(parseCookies(req.headers.cookie)[COOKIE])) return true;
  const token = req.get('x-admin-token');
  return Boolean(token) && token === ADMIN_TOKEN;
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({
    ok: false,
    error: isPasswordConfigured()
      ? 'Please log in to change the rate.'
      : 'Invalid admin token.',
    needsLogin: isPasswordConfigured(),
  });
}

app.get('/api/admin/session', (req, res) => {
  res.json({
    ok: true,
    authenticated: isAdmin(req),
    passwordConfigured: isPasswordConfigured(),
  });
});

// Enough to stop guessing at scale, forgiving enough for a shopkeeper who
// mistypes. A successful login clears the count entirely (see below).
app.post('/api/admin/login', limit('login', 12, 10 * 60e3), (req, res) => {
  if (!isPasswordConfigured()) {
    return res.status(503).json({
      ok: false,
      error:
        'No admin password has been set yet. Run "npm run set-password" and add the line it prints to your .env file.',
    });
  }

  const okUser = verifyUsername(req.body?.username);
  const okPass = verifyPassword(String(req.body?.password ?? ''), process.env.ADMIN_PASSWORD_HASH);

  // Both are checked before replying, and one message covers either failure —
  // never reveal which half was wrong.
  if (!okUser || !okPass) {
    return res.status(401).json({ ok: false, error: 'That ID or password is not correct.' });
  }

  // Proved who they are — a few earlier typos should not count against them.
  clearLimit('login', req);
  res.setHeader('Set-Cookie', sessionCookie(createSession(), { secure: req.secure }));
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', { clear: true, secure: req.secure }));
  res.json({ ok: true });
});

// --- validation helpers -----------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Trim, cap the length, and strip control characters.
 *
 * The stripping is the part that earns its place. Values from these forms reach
 * mail headers — the owner's booking notice puts the customer's name straight
 * into the Subject line, and their address into Reply-To — and a carriage
 * return inside a header is exactly how header injection is done. nodemailer
 * guards against it as well, but a value that cannot contain a newline cannot
 * be smuggled through anything, now or after some future upgrade.
 *
 * `multiline` keeps real line breaks for fields that only ever reach a message
 * body and never a header.
 */
// Every C0 control character plus DEL. Built from codepoints rather than
// typed literally, so the source stays readable and diffable.
const CONTROL_CHARS = new RegExp('[\u0000-\u001F\u007F]', 'g');
// The same, but sparing U+000A so genuine line breaks survive in body text.
const CONTROL_BUT_NEWLINE = new RegExp('[\u0000-\u0009\u000B-\u001F\u007F]', 'g');

const clean = (v, max = 200, { multiline = false } = {}) =>
  String(v ?? '')
    .replace(multiline ? CONTROL_BUT_NEWLINE : CONTROL_CHARS, '')
    .trim()
    .slice(0, max);

function validEmail(v) {
  return EMAIL_RE.test(v) && v.length <= 254;
}
function normalisePhone(v) {
  const digits = String(v ?? '').replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

// --- appointment slots ------------------------------------------------------
const SLOT_MINUTES = 30;
const SLOTS_PER_TIME = 2; // two customers can be attended to at once

function slotsForDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (!BUSINESS.hours.openDays.includes(d.getDay())) return [];

  const out = [];
  const end = BUSINESS.hours.closeHour * 60 - SLOT_MINUTES;
  for (let m = BUSINESS.hours.openHour * 60; m <= end; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    out.push({ value: `${String(h).padStart(2, '0')}:${mm}`, label: `${h12}:${mm} ${suffix}` });
  }
  return out;
}

function withinBookingWindow(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 60);
  return d >= today && d <= max;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

app.get('/api/config', async (_req, res) => {
  res.json({
    business: {
      name: BUSINESS.name,
      tagline: BUSINESS.tagline,
      address: {
        line1: BUSINESS.address.line1,
        line2: BUSINESS.address.line2,
        area: BUSINESS.address.area,
        city: BUSINESS.address.city,
        state: BUSINESS.address.state,
        pincode: BUSINESS.address.pincode,
        full: BUSINESS.address.full,
      },
      mapsUrl: BUSINESS.mapsUrl,
      owners: BUSINESS.owners.map((o) => ({
        name: o.name,
        phone: o.phone,
        display: `+91 ${o.phone.slice(0, 5)} ${o.phone.slice(5)}`,
        tel: `tel:+91${o.phone}`,
        whatsapp: whatsappLink(o, `Hello ${BUSINESS.name}, I found you through your website.`),
      })),
      email: BUSINESS.email.primary,
      social: BUSINESS.social,
      // Only stats with a real value reach the browser.
      stats: {
        ...BUSINESS.stats,
        items: BUSINESS.stats.items.filter((s) => s.value !== null && s.value !== undefined),
      },
      hours: BUSINESS.hours,
      assurances: BUSINESS.assurances,
      gstRate: BUSINESS.gstRate,
    },
    purity: PURITY,
    categories: CATEGORIES,
    finishes: FINISHES,
    bullion: BULLION,
    chat: chatMeta(),
    mail: { configured: isMailConfigured() },
  });
});

app.get('/api/rates', async (_req, res, next) => {
  try {
    const r = await getRates();
    res.json({ ok: true, rates: r });
  } catch (err) {
    next(err);
  }
});

app.post('/api/rates', limit('rates', 30, 60e3), requireAdmin, async (req, res, next) => {
  try {
    const rates = await setRates(req.body ?? {}, clean(req.body?.actor, 60) || 'showroom');
    res.json({ ok: true, rates });

    // After replying — nobody should wait on the post for an email run.
    runRateDropAlerts(rates).catch((err) => console.error('[alerts]', err));
  } catch (err) {
    next(err);
  }
});

app.post('/api/reminder/run', limit('reminder', 10, 60e3), requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await runReminder({ force: Boolean(req.body?.force) })) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/products', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await getProducts()) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/testimonials', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await getTestimonials()) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/muhurat', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await getMuhurat()) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/quote', async (req, res, next) => {
  try {
    const rates = await getRates();
    res.json({ ok: true, quote: computePrice({ rates, ...req.body }) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/slots', async (req, res, next) => {
  try {
    const date = clean(req.query.date, 10);
    const all = slotsForDate(date);
    if (all === null) return res.status(400).json({ ok: false, error: 'Invalid date.' });
    if (!withinBookingWindow(date)) {
      return res.json({ ok: true, open: false, reason: 'outside_window', slots: [] });
    }
    if (all.length === 0) {
      return res.json({ ok: true, open: false, reason: 'closed', slots: [] });
    }

    const booked = await readJson('appointments.json', []);
    const taken = booked.filter((b) => b.date === date && b.status !== 'cancelled');
    const counts = taken.reduce((acc, b) => ((acc[b.time] = (acc[b.time] ?? 0) + 1), acc), {});

    // Don't offer a slot that has already passed today.
    const now = new Date();
    const isToday = date === now.toISOString().slice(0, 10);
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    res.json({
      ok: true,
      open: true,
      slots: all.map((s) => {
        const [h, m] = s.value.split(':').map(Number);
        const past = isToday && h * 60 + m <= minutesNow + 30;
        return { ...s, available: !past && (counts[s.value] ?? 0) < SLOTS_PER_TIME };
      }),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/appointments', limit('appt', 6, 10 * 60e3), async (req, res, next) => {
  try {
    const name = clean(req.body?.name, 80);
    const phone = normalisePhone(req.body?.phone);
    const email = clean(req.body?.email, 254);
    const date = clean(req.body?.date, 10);
    const time = clean(req.body?.time, 5);
    const purpose = clean(req.body?.purpose, 80) || 'General enquiry';
    // Only ever reaches the message body, so real line breaks are kept.
    const notes = clean(req.body?.notes, 500, { multiline: true });

    const errors = {};
    if (name.length < 2) errors.name = 'Please enter your name.';
    if (!phone) errors.phone = 'Please enter a valid 10-digit Indian mobile number.';
    if (email && !validEmail(email)) errors.email = 'That email address does not look right.';
    if (!withinBookingWindow(date)) errors.date = 'Please choose a date within the next 60 days.';

    const slots = slotsForDate(date);
    if (!slots || slots.length === 0) {
      errors.date = errors.date ?? `We are closed that day. ${BUSINESS.hours.closedLabel}.`;
    } else if (!slots.some((s) => s.value === time)) {
      errors.time = 'Please choose a time from the list.';
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, errors });
    }

    const existing = await readJson('appointments.json', []);
    const sameSlot = existing.filter(
      (b) => b.date === date && b.time === time && b.status !== 'cancelled'
    );
    if (sameSlot.length >= SLOTS_PER_TIME) {
      return res.status(409).json({
        ok: false,
        errors: { time: 'That slot was just taken. Please pick another time.' },
      });
    }

    const reference = `KG-${date.replace(/-/g, '').slice(4)}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const label = slots.find((s) => s.value === time)?.label ?? time;
    const prettyDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const booking = {
      reference,
      name,
      phone,
      email: email || null,
      date,
      time,
      timeLabel: label,
      purpose,
      notes: notes || null,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    await append('appointments.json', booking);

    // Notify the showroom, and the customer if they gave us an address.
    const ownerMail = await send({
      to: BUSINESS.email.primary,
      ...ownerAppointmentNotice({ ...booking, date: prettyDate, time: label }),
    });

    let customerMail = { delivered: false, reason: 'no_email' };
    if (email) {
      customerMail = await send({
        to: email,
        ...appointmentEmail({ ...booking, date: prettyDate, time: label }),
      });
    }

    res.json({
      ok: true,
      reference,
      date: prettyDate,
      time: label,
      emailSent: customerMail.delivered,
      ownerNotified: ownerMail.delivered,
      mailConfigured: isMailConfigured(),
      whatsapp: whatsappLink(
        BUSINESS.owners[0],
        `Hello ${BUSINESS.name}, I have booked an appointment. Reference ${reference}, ${prettyDate} at ${label}.`
      ),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/subscribe', limit('sub', 6, 10 * 60e3), async (req, res, next) => {
  try {
    const name = clean(req.body?.name, 80);
    const email = clean(req.body?.email, 254);

    if (!validEmail(email)) {
      return res.status(400).json({ ok: false, errors: { email: 'Please enter a valid email address.' } });
    }

    const rates = await getRates();
    const alert = validateAlertBelow(req.body?.alertBelow, rates);
    if (!alert.ok) {
      return res.status(400).json({ ok: false, errors: { alertBelow: alert.error } });
    }

    const list = await readJson('subscribers.json', []);
    const existing = list.find((s) => s.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      // Let someone come back and set, change or clear their figure.
      if (alert.value !== existing.alertBelow) {
        existing.alertBelow = alert.value;
        existing.alertedAt = null;
        await writeJson('subscribers.json', list);
        return res.json({
          ok: true,
          alreadySubscribed: true,
          message: alert.value
            ? `Updated. We will write to you when 22K reaches ₹${alert.value.toLocaleString('en-IN')}.`
            : 'Updated. Your rate alert has been turned off — you will still get the daily rates.',
        });
      }
      return res.json({
        ok: true,
        alreadySubscribed: true,
        message: 'You are already on our alert list — no need to sign up again.',
      });
    }

    const record = {
      name: name || null,
      email,
      alertBelow: alert.value,
      alertedAt: null,
      subscribedAt: new Date().toISOString(),
      status: 'active',
    };
    await append('subscribers.json', record);

    const welcome = await send({ to: email, ...welcomeEmail(name) });
    await send({ to: BUSINESS.email.primary, ...ownerSubscriberNotice(record) });

    res.json({
      ok: true,
      emailSent: welcome.delivered,
      mailConfigured: isMailConfigured(),
      message:
        (welcome.delivered
          ? 'You are on the list. A welcome note is on its way to your inbox.'
          : 'You are on the list. Our email delivery is not switched on yet, so your welcome note is saved and will be sent as soon as it is.') +
        (alert.value
          ? ` We will write to you separately the day 22K reaches ₹${alert.value.toLocaleString('en-IN')}.`
          : ''),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/chat', limit('chat', 30, 5 * 60e3), async (req, res, next) => {
  try {
    const message = clean(req.body?.message, 800);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
    res.json({ ok: true, ...(await chatReply(message, history)) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Search engines
// ---------------------------------------------------------------------------

/**
 * Where this site actually lives, with no trailing slash. Both files below have
 * to name the site absolutely, so PUBLIC_URL is the answer whenever it is set.
 * Failing that we read the host off the request — behind Render's proxy the
 * original scheme survives only in x-forwarded-proto.
 */
function siteOrigin(req) {
  const configured = process.env.PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${req.get('host')}`;
}

/**
 * Dedicated pages for the things the shop does — the rate, the jewellery, the
 * bullion, how a price is built, and where to find us.
 *
 * Registered before the single-page catch-all, so /gold-rate-ahmedabad is a
 * page in its own right rather than the front page wearing a different address.
 */
app.get('/:slug', async (req, res, next) => {
  if (!isServicePage(req.params.slug)) return next();
  try {
    const html = await renderPage(req.params.slug, siteOrigin(req));
    if (!html) return next();

    // The page carries its own JSON-LD block, which the startup scan of
    // index.html never saw and whose hash is therefore missing from the policy.
    // Restate the policy for this one response with that block's hash added,
    // rather than loosening script-src for the whole site.
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const csp = res.getHeader('Content-Security-Policy');
    if (ld && typeof csp === 'string') {
      const digest = crypto.createHash('sha256').update(ld[1], 'utf8').digest('base64');
      res.setHeader(
        'Content-Security-Policy',
        csp.replace("script-src 'self'", `script-src 'self' 'sha256-${digest}'`)
      );
    }

    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

// A plain-language summary of the shop for language models (llmstxt.org).
app.get('/llms.txt', (req, res) => {
  res.type('text/plain').send(llmsTxt(siteOrigin(req)));
});

app.get('/robots.txt', (req, res) => {
  res
    .type('text/plain')
    .send(
      [
        'User-agent: *',
        'Allow: /',
        // The rate page needs a password, and the JSON endpoints are no use to
        // anyone reading search results. Keep both out of the index.
        'Disallow: /admin',
        'Disallow: /api/',
        '',
        `Sitemap: ${siteOrigin(req)}/sitemap.xml`,
        '',
      ].join('\n')
    );
});

/**
 * One page, one entry.
 *
 * The catalogue deep links (?piece=…) are drawn by the browser out of the same
 * HTML, so listing all thirty would hand Google thirty copies of one page
 * rather than thirty pages — which counts against a site, not for it.
 */
app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const { updatedAt } = await getRates();
    const lastmod = (updatedAt ?? new Date().toISOString()).slice(0, 10);
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteOrigin(req)}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
  </url>
${PAGES.map((page) => `  <url>
    <loc>${siteOrigin(req)}/${page.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join("\n")}
  <url>
    <loc>${siteOrigin(req)}/privacy</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
`
    );
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Static assets
// ---------------------------------------------------------------------------

// three.js and motion are served from node_modules so the site works with no CDN
// and no build step. motion ships a UMD bundle, which needs no import map.
app.use(
  '/vendor/three',
  express.static(path.join(ROOT, 'node_modules/three/build'), {
    maxAge: '30d',
    immutable: true,
  })
);
app.use(
  '/vendor/motion',
  express.static(path.join(ROOT, 'node_modules/motion/dist'), {
    maxAge: '30d',
    immutable: true,
  })
);
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    ok: false,
    error: status >= 500 ? 'Something went wrong at our end. Please try again.' : err.message,
  });
});

await ensureDirs();
await getRates(); // seed data/rates.json on first boot

app.listen(PORT, () => {
  const rule = '─'.repeat(64);
  console.log(`\n${rule}`);
  console.log(`  ${BUSINESS.name} — running on http://localhost:${PORT}`);
  console.log(rule);
  console.log(`  Email      ${isMailConfigured() ? `sending as ${BUSINESS.email.primary}` : 'NOT configured — mail queues to data/outbox/'}`);
  console.log(`  Chatbot    ${process.env.ANTHROPIC_API_KEY ? 'intent engine + Claude' : 'intent engine (set ANTHROPIC_API_KEY to add Claude)'}`);
  console.log(
    `  Rate page  http://localhost:${PORT}/admin  ${
      isPasswordConfigured()
        ? '(password protected)'
        : 'NO PASSWORD SET — run "npm run set-password"'
    }`
  );
  console.log(`  Admin key  ${ADMIN_TOKEN}${ADMIN_TOKEN_GENERATED ? '  (generated — set ADMIN_TOKEN in .env to keep it stable)' : ''}`);
  startReminderSchedule();
  console.log(`${rule}\n`);
});
