/**
 * Outbound email. Every message is sent from — and every owner notification is
 * sent to — primeplay345@gmail.com (BUSINESS.email.primary).
 *
 * If SMTP_PASS is not configured the mail is written to data/outbox/ instead of
 * being dropped, and send() reports delivered:false so the website can tell the
 * visitor the truth ("saved, delivery pending") rather than faking success.
 */
import nodemailer from 'nodemailer';
import { BUSINESS } from './config.js';
import { queueOutbox } from './store.js';

const PRIMARY = BUSINESS.email.primary;
const FROM = `"${BUSINESS.email.displayName}" <${PRIMARY}>`;

let transporter = null;

export function isMailConfigured() {
  return Boolean(process.env.SMTP_PASS && process.env.SMTP_USER);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * @returns {Promise<{delivered: boolean, reason?: string, queuedAt?: string}>}
 */
export async function send({ to, subject, text, html, replyTo }) {
  const message = { from: FROM, to, subject, text, html, replyTo: replyTo || PRIMARY };
  const tx = getTransporter();

  if (!tx) {
    const file = await queueOutbox({ ...message, queuedAt: new Date().toISOString() });
    return { delivered: false, reason: 'smtp_not_configured', queuedAt: file };
  }

  try {
    await tx.sendMail(message);
    return { delivered: true };
  } catch (err) {
    const file = await queueOutbox({
      ...message,
      queuedAt: new Date().toISOString(),
      error: err.message,
    });
    console.error('[mail] send failed, queued to outbox:', err.message);
    return { delivered: false, reason: 'send_failed', queuedAt: file };
  }
}

// ---------------------------------------------------------------------------
// Shared shell. Email clients need tables and inline styles — no external CSS.
// ---------------------------------------------------------------------------

const ADDRESS_TEXT = [
  BUSINESS.address.line1,
  BUSINESS.address.line2,
  `${BUSINESS.address.area}, ${BUSINESS.address.city}, ${BUSINESS.address.state} ${BUSINESS.address.pincode}`,
].join('\n');

const phoneLabel = (p) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

const contactsText = BUSINESS.owners
  .map((o) => `${o.name} — ${phoneLabel(o.phone)}`)
  .join('\n');

function shell(title, innerHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#F1EDE4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EDE4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border:1px solid #E2D9C4;">

  <tr><td style="background:#0B1712;padding:26px 32px;">
    <div style="font:600 19px/1.2 Georgia,'Times New Roman',serif;color:#F0D48A;letter-spacing:.02em;">
      ${BUSINESS.name}
    </div>
    <div style="font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#A8B5AC;padding-top:5px;letter-spacing:.09em;text-transform:uppercase;">
      ${BUSINESS.address.area}, ${BUSINESS.address.city}
    </div>
  </td></tr>

  <tr><td style="height:3px;background:linear-gradient(90deg,#A97722,#F0D48A,#A97722);font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td style="padding:32px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#23291F;">
    ${innerHtml}
  </td></tr>

  <tr><td style="background:#0B1712;padding:24px 32px;font:400 13px/1.7 Arial,Helvetica,sans-serif;color:#A8B5AC;">
    <div style="color:#F0D48A;font-weight:600;padding-bottom:8px;">Visit us</div>
    <div>${BUSINESS.address.line1}<br>${BUSINESS.address.line2}<br>
      ${BUSINESS.address.area}, ${BUSINESS.address.city}, ${BUSINESS.address.state} ${BUSINESS.address.pincode}</div>
    <div style="padding-top:12px;">${BUSINESS.hours.label}<br>${BUSINESS.hours.closedLabel}</div>
    <div style="padding-top:12px;">
      ${BUSINESS.owners
        .map(
          (o) =>
            `${o.name} — <a href="tel:+91${o.phone}" style="color:#F0D48A;text-decoration:none;">+91 ${o.phone.slice(0, 5)} ${o.phone.slice(5)}</a>`
        )
        .join('<br>')}
    </div>
    <div style="padding-top:12px;">
      <a href="mailto:${PRIMARY}" style="color:#F0D48A;text-decoration:none;">${PRIMARY}</a>
    </div>
  </td></tr>

</table></td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------------
// Rate-alert welcome
// ---------------------------------------------------------------------------

export function welcomeEmail(name) {
  const greeting = name ? `Dear ${name},` : 'Dear Customer,';

  const text = `${greeting}

Thank you for choosing to receive gold rate alerts from ${BUSINESS.name}.

We understand that buying gold is rarely an ordinary purchase. It is usually tied to a wedding, a new home, a daughter's future, or a quiet decision to protect what a family has worked many years to build. In each of those, timing matters and price matters. That is precisely why we send these alerts — so that you are never guessing, and never buying blind.

From today, you will receive:

  - Our indicative 22K (916) and 24K rates for Ahmedabad, updated on each trading day
  - A note whenever the rate moves sharply, so that you can act rather than react
  - Early intimation of our making-charge offers, before they are advertised publicly

Two commitments we would like to make to you in writing.

First, on purity. Every piece of jewellery we sell is BIS hallmarked, and our jewellery is guaranteed 916 / 22K. You are welcome to have anything you buy from us independently tested. We would much rather earn your trust than be asked to assume it.

Second, on your privacy. We will never sell, rent or share your email address, and we will never send you anything you did not ask for. If you wish to stop these alerts, a one-word reply saying "stop" is enough, and they will end the same day.

Should you wish to see a piece in person, our doors are open ${BUSINESS.hours.label}. ${BUSINESS.hours.closedLabel}.

${ADDRESS_TEXT}

You are welcome simply to walk in. If you would prefer not to wait, you may book a private viewing on our website and one of us will attend to you personally.

We are a family business, and we are genuinely glad to have you with us.

With sincere regards,

${contactsText}
${BUSINESS.name}
${PRIMARY}`;

  const html = shell(
    `Welcome to ${BUSINESS.name} rate alerts`,
    `
    <p style="margin:0 0 18px;">${greeting}</p>

    <p style="margin:0 0 18px;">Thank you for choosing to receive gold rate alerts from
      <strong>${BUSINESS.name}</strong>.</p>

    <p style="margin:0 0 18px;">We understand that buying gold is rarely an ordinary purchase. It is
      usually tied to a wedding, a new home, a daughter's future, or a quiet decision to protect what
      a family has worked many years to build. In each of those, timing matters and price matters.
      That is precisely why we send these alerts &mdash; so that you are never guessing, and never
      buying blind.</p>

    <p style="margin:0 0 10px;">From today, you will receive:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${[
        'Our indicative 22K (916) and 24K rates for Ahmedabad, updated on each trading day',
        'A note whenever the rate moves sharply, so that you can act rather than react',
        'Early intimation of our making-charge offers, before they are advertised publicly',
      ]
        .map(
          (li) =>
            `<tr><td valign="top" style="padding:0 10px 8px 0;color:#A97722;font-weight:700;">&bull;</td>
             <td valign="top" style="padding:0 0 8px;">${li}</td></tr>`
        )
        .join('')}
    </table>

    <p style="margin:0 0 18px;">Two commitments we would like to make to you in writing.</p>

    <p style="margin:0 0 18px;"><strong>First, on purity.</strong> Every piece of jewellery we sell is
      BIS hallmarked, and our jewellery is guaranteed 916 / 22K. You are welcome to have anything you
      buy from us independently tested. We would much rather earn your trust than be asked to assume
      it.</p>

    <p style="margin:0 0 18px;"><strong>Second, on your privacy.</strong> We will never sell, rent or
      share your email address, and we will never send you anything you did not ask for. If you wish
      to stop these alerts, a one-word reply saying &ldquo;stop&rdquo; is enough, and they will end the
      same day.</p>

    <p style="margin:0 0 18px;">Should you wish to see a piece in person, our doors are open
      ${BUSINESS.hours.label}. ${BUSINESS.hours.closedLabel}.</p>

    <p style="margin:0 0 18px;">You are welcome simply to walk in. If you would prefer not to wait, you
      may book a private viewing on our website and one of us will attend to you personally.</p>

    <p style="margin:0 0 22px;">We are a family business, and we are genuinely glad to have you with
      us.</p>

    <p style="margin:0;">With sincere regards,<br>
      <strong>Sunil Patwari</strong> and <strong>Anil Patwari</strong><br>
      <span style="color:#5C6B58;">${BUSINESS.name}</span></p>
  `
  );

  return { subject: `Welcome to ${BUSINESS.name} — your gold rate alerts are active`, text, html };
}

// ---------------------------------------------------------------------------
// Appointment confirmation (to the customer)
// ---------------------------------------------------------------------------

export function appointmentEmail(booking) {
  const { name, date, time, purpose, reference } = booking;

  const text = `Dear ${name},

Your appointment at ${BUSINESS.name} is confirmed.

  Reference   ${reference}
  Date        ${date}
  Time        ${time}
  Purpose     ${purpose}

${ADDRESS_TEXT}

We have set this time aside for you, so please do come. If something changes and you cannot make it, a short message or call on either number below is all we need — there is no cancellation charge, and no awkwardness.

What to expect: one of us will attend to you personally. You are under no obligation to buy anything on the day. If you are bringing old gold for valuation, please carry the original bill if you still have it — it makes the process considerably faster for you.

${contactsText}

We look forward to welcoming you.

With sincere regards,
${BUSINESS.name}
${PRIMARY}`;

  const row = (k, v) =>
    `<tr>
       <td style="padding:9px 16px 9px 0;color:#5C6B58;font-size:13px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">${k}</td>
       <td style="padding:9px 0;font-weight:700;color:#12211A;">${v}</td>
     </tr>`;

  const html = shell(
    `Appointment confirmed — ${BUSINESS.name}`,
    `
    <p style="margin:0 0 18px;">Dear ${name},</p>
    <p style="margin:0 0 20px;">Your appointment at <strong>${BUSINESS.name}</strong> is confirmed.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background:#F7F3E9;border-left:3px solid #A97722;padding:8px 18px;margin:0 0 22px;">
      ${row('Reference', reference)}
      ${row('Date', date)}
      ${row('Time', time)}
      ${row('Purpose', purpose)}
    </table>

    <p style="margin:0 0 18px;">We have set this time aside for you, so please do come. If something
      changes and you cannot make it, a short message or call on either number below is all we need
      &mdash; there is no cancellation charge, and no awkwardness.</p>

    <p style="margin:0 0 18px;"><strong>What to expect.</strong> One of us will attend to you
      personally. You are under no obligation to buy anything on the day. If you are bringing old gold
      for valuation, please carry the original bill if you still have it &mdash; it makes the process
      considerably faster for you.</p>

    <p style="margin:0 0 22px;">We look forward to welcoming you.</p>

    <p style="margin:0;">With sincere regards,<br>
      <strong>Sunil Patwari</strong> and <strong>Anil Patwari</strong><br>
      <span style="color:#5C6B58;">${BUSINESS.name}</span></p>
  `
  );

  return { subject: `Appointment confirmed — ${date}, ${time} — ${BUSINESS.name}`, text, html };
}

// ---------------------------------------------------------------------------
// Internal notifications to the showroom (primeplay345@gmail.com)
// ---------------------------------------------------------------------------

export function ownerAppointmentNotice(b) {
  const lines = [
    `Reference : ${b.reference}`,
    `Name      : ${b.name}`,
    `Phone     : ${b.phone}`,
    `Email     : ${b.email || '—'}`,
    `Date      : ${b.date}`,
    `Time      : ${b.time}`,
    `Purpose   : ${b.purpose}`,
    `Notes     : ${b.notes || '—'}`,
  ].join('\n');

  return {
    subject: `New appointment — ${b.date} ${b.time} — ${b.name}`,
    text: `A new appointment was booked on the website.\n\n${lines}\n`,
    html: shell(
      'New appointment booked',
      `<p style="margin:0 0 16px;">A new appointment was booked on the website.</p>
       <pre style="margin:0;background:#F7F3E9;border-left:3px solid #A97722;padding:16px;font:13px/1.7 Consolas,Menlo,monospace;white-space:pre-wrap;">${lines}</pre>`
    ),
    replyTo: b.email || undefined,
  };
}

/**
 * The daily 12:00 PM prompt. Carries a tap-to-send WhatsApp link per owner with
 * the request already written, so updating the rate is two taps from the inbox.
 */
export function rateReminderEmail({ dateLabel, adminUrl, owners, currentRates }) {
  const ask = owners
    .map((o) => `${o.name} (${phoneLabel(o.phone)}):\n  ${o.waLink}`)
    .join('\n\n');

  const showing = currentRates.isPlaceholder
    ? 'The website is still showing PLACEHOLDER rates.'
    : `The website is currently showing 24K ${currentRates.gold24}/g, 22K ${currentRates.gold22}/g, 18K ${currentRates.gold18}/g.`;

  const text = `Daily rate reminder — ${dateLabel}

${showing}

Ask the owners for today's figures by tapping a link below. The message is
already written; you only need to press send.

${ask}

Once you have the numbers, enter them here:
${adminUrl}

— KG Gold Garden website`;

  const html = shell(
    `Daily rate reminder — ${dateLabel}`,
    `
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#5C6B58;">
      Daily reminder &middot; ${dateLabel}</p>
    <h1 style="margin:0 0 18px;font:400 26px/1.2 Georgia,serif;color:#12211A;">
      Today's gold rate is not in yet</h1>

    <p style="margin:0 0 20px;">${showing}</p>

    <p style="margin:0 0 14px;">Tap a name to ask on WhatsApp &mdash; the message is already
      written, you only need to press send:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${owners
        .map(
          (o) => `<tr><td style="padding:0 0 10px;">
            <a href="${o.waLink}"
               style="display:inline-block;background:#1F7A52;color:#ffffff;text-decoration:none;
                      padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px;">
              Ask ${o.name} &nbsp;&rsaquo;</a>
            <span style="color:#5C6B58;font-size:13px;padding-left:10px;">${phoneLabel(o.phone)}</span>
          </td></tr>`
        )
        .join('')}
    </table>

    <p style="margin:0 0 12px;">Then enter the three figures here:</p>
    <p style="margin:0 0 8px;">
      <a href="${adminUrl}"
         style="display:inline-block;background:#A97722;color:#ffffff;text-decoration:none;
                padding:12px 22px;border-radius:999px;font-weight:700;font-size:14px;">
        Open the rate page</a>
    </p>
    <p style="margin:0;color:#5C6B58;font-size:13px;">${adminUrl}</p>
  `
  );

  return { subject: `Enter today's gold rate — ${dateLabel}`, text, html };
}

/** Sent once, when 22K reaches the figure a subscriber asked to be told about. */
export function rateDropEmail({ name, target, rates }) {
  const greeting = name ? `Dear ${name},` : 'Dear Customer,';
  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  const text = `${greeting}

You asked us to tell you when our 22K rate came down to ${money(target)}.

It has. Today 22K (916) is ${money(rates.gold22)} per gram, and 24K is ${money(rates.gold24)}.

We are not going to tell you this is the bottom, because nobody knows that. What
we can tell you is that the figure you were waiting for has been reached, and
that we have it in stock today.

If you would like to come in, we are open ${BUSINESS.hours.label}.
${BUSINESS.hours.closedLabel}.

${ADDRESS_TEXT}

You are welcome to walk in, or to book a private viewing on our website so one of
us can set the time aside for you.

${contactsText}

With sincere regards,
${BUSINESS.name}
${PRIMARY}

You will not get another one of these until the rate rises above ${money(target)}
and comes back down again. Reply "stop" at any time and the alerts end.`;

  const html = shell(
    `22K has reached ${money(target)}`,
    `
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#5C6B58;">
      The rate you were waiting for</p>
    <h1 style="margin:0 0 20px;font:400 30px/1.2 Georgia,serif;color:#12211A;">
      22K is now ${money(rates.gold22)}</h1>

    <p style="margin:0 0 18px;">${greeting}</p>
    <p style="margin:0 0 20px;">You asked us to tell you when our 22K rate came down to
      <strong>${money(target)}</strong>. It has.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background:#F7F3E9;border-left:3px solid #A97722;padding:8px 18px;margin:0 0 22px;">
      <tr><td style="padding:9px 16px 9px 0;color:#5C6B58;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">22K &middot; 916</td>
          <td style="padding:9px 0;font-weight:700;color:#12211A;">${money(rates.gold22)} / gram</td></tr>
      <tr><td style="padding:9px 16px 9px 0;color:#5C6B58;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">24K &middot; 999</td>
          <td style="padding:9px 0;font-weight:700;color:#12211A;">${money(rates.gold24)} / gram</td></tr>
    </table>

    <p style="margin:0 0 18px;">We are not going to tell you this is the bottom, because
      nobody knows that. What we can tell you is that the figure you were waiting for has
      been reached, and that we have it in stock today.</p>

    <p style="margin:0 0 22px;">We are open ${BUSINESS.hours.label}. ${BUSINESS.hours.closedLabel}.
      Walk in, or book a private viewing and one of us will set the time aside for you.</p>

    <p style="margin:0 0 22px;">With sincere regards,<br>
      <strong>Sunil Patwari</strong> and <strong>Anil Patwari</strong></p>

    <p style="margin:0;padding-top:16px;border-top:1px solid #E2D9C4;font-size:12px;color:#7C8A78;">
      You will not get another one of these until the rate rises above ${money(target)} and comes
      back down again. Reply &ldquo;stop&rdquo; at any time and the alerts end.</p>
  `
  );

  return { subject: `22K has reached ${money(target)} — ${BUSINESS.name}`, text, html };
}

export function ownerSubscriberNotice(s) {
  const lines = [
    `Name  : ${s.name || '—'}`,
    `Email : ${s.email}`,
    `Alert : ${s.alertBelow ? `wants to be told when 22K reaches ₹${Number(s.alertBelow).toLocaleString('en-IN')}` : 'daily rates only'}`,
  ].join('\n');
  return {
    subject: `New rate-alert subscriber — ${s.email}`,
    text: `Someone subscribed to gold rate alerts.\n\n${lines}\n`,
    html: shell(
      'New rate-alert subscriber',
      `<p style="margin:0 0 16px;">Someone subscribed to gold rate alerts on the website.</p>
       <pre style="margin:0;background:#F7F3E9;border-left:3px solid #A97722;padding:16px;font:13px/1.7 Consolas,Menlo,monospace;white-space:pre-wrap;">${lines}</pre>`
    ),
    replyTo: s.email,
  };
}
