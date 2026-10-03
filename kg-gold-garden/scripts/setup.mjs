#!/usr/bin/env node
/**
 * Guided setup:  npm run setup
 *
 *   1. the admin ID and password for the rate page
 *   2. the four EmailJS values that let the site actually send email
 *
 * Nothing secret is echoed to the screen or written to your shell history. The
 * password is stored only as a scrypt hash; the EmailJS values are written
 * straight into .env, which is git-ignored, and go nowhere except to EmailJS
 * itself if you ask for a test email.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../server/auth.js';
import { BUSINESS } from '../server/config.js';
import { question, stop } from './prompt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const PRIMARY = BUSINESS.email.primary;
const rule = (c = '─') => c.repeat(70);

// --- prompts ----------------------------------------------------------------

const ask = async (text, fallback = '') => (await question(text)) || fallback;
const askHidden = (text) => question(text, { hidden: true });

const yes = async (text, def = true) => {
  const a = (await ask(`${text} ${def ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
  if (!a) return def;
  return a.startsWith('y');
};

// --- .env -------------------------------------------------------------------

function upsert(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return `${content.replace(/\s*$/, '')}\n${line}\n`;
}

async function loadEnv() {
  try {
    return await readFile(ENV_PATH, 'utf8');
  } catch {
    // Start from the documented template if there is one.
    try {
      return await readFile(path.join(ROOT, '.env.example'), 'utf8');
    } catch {
      return '';
    }
  }
}

// --- run --------------------------------------------------------------------

console.log(`\n${rule('═')}`);
console.log('  KG Gold Garden — setup');
console.log(rule('═'));
console.log('  Nothing you type here is shown on screen or saved to history.\n');

let env = await loadEnv();
const changes = [];

// 1 ---------------------------------------------------------------- admin ---
console.log(`${rule()}\n  1. The rate page  (/admin)\n${rule()}`);

if (await yes('Set the admin ID and password now?')) {
  // Offer whatever ID is already configured, so changing only the password is
  // one press of Enter.
  const currentId = (env.match(/^\s*ADMIN_USERNAME\s*=\s*(.*)$/m)?.[1] ?? '').trim() || 'admin';
  const id = await ask(`  Admin ID [${currentId}]: `, currentId);

  let password = '';
  for (;;) {
    password = await askHidden('  Password (min 8 characters): ');
    if (password.length < 8) {
      console.log('  → Too short. Try again.');
      continue;
    }
    const again = await askHidden('  Type it once more:          ');
    if (password !== again) {
      console.log('  → Those did not match. Try again.');
      continue;
    }
    break;
  }

  env = upsert(env, 'ADMIN_USERNAME', id);
  env = upsert(env, 'ADMIN_PASSWORD_HASH', hashPassword(password));
  changes.push(`Admin login set. ID: ${id}`);
  console.log('  ✓ Saved. Only a hash is stored — the password cannot be read back.\n');
} else {
  console.log('  Skipped.\n');
}

// 2 ---------------------------------------------------------------- email ---
console.log(`${rule()}\n  2. Email  (sending from ${PRIMARY}, through EmailJS)\n${rule()}`);
console.log(`
  The server cannot reach a mail server itself — Render's free plan blocks
  it — so email goes through EmailJS. Once the Yahoo service and the template
  exist (the steps are in DEPLOY.md), copy four values from
  https://dashboard.emailjs.com :

    Service ID    Email Services → your Yahoo service
    Template ID   Email Templates → the KG template
    Public Key    Account → General
    Private Key   Account → General   (secret — not shown as you type)

  And on Account → Security, switch on BOTH "allow API requests from
  non-browser applications" and "use Private Key", or every send is refused.
`);

if (await yes('Do you have all four ready?', false)) {
  const values = {
    EMAILJS_SERVICE_ID: (await ask('  Service ID:  ')).trim(),
    EMAILJS_TEMPLATE_ID: (await ask('  Template ID: ')).trim(),
    EMAILJS_PUBLIC_KEY: (await ask('  Public Key:  ')).trim(),
    EMAILJS_PRIVATE_KEY: (await askHidden('  Private Key: ')).trim(),
  };
  const missing = Object.keys(values).filter((k) => !values[k]);

  if (missing.length) {
    console.log(`\n  ✗ Missing ${missing.join(', ')}. Nothing was saved for email.\n`);
  } else {
    for (const [key, value] of Object.entries(values)) env = upsert(env, key, value);
    changes.push('EmailJS keys saved.');

    if (await yes(`\n  Send one test email to ${PRIMARY} to confirm it arrives?`)) {
      // The site's own sender, so the test proves exactly what customers get.
      Object.assign(process.env, values);
      const { send } = await import('../server/mailer.js');
      process.stdout.write('  Sending… ');
      const result = await send({
        to: PRIMARY,
        subject: 'KG Gold Garden — email is working',
        text: 'This is a test from your own website. If you are reading this, email is set up correctly.',
        html:
          '<p>This is a test from your own website.</p>' +
          '<p>If you are reading this, email is set up correctly: booking confirmations and ' +
          'rate-alert emails will now reach customers.</p><p>&mdash; KG Gold Garden website</p>',
      });
      if (result.delivered) {
        console.log(`sent. Check the inbox for ${PRIMARY}.\n`);
      } else {
        console.log('not sent.');
        console.log(`\n  ✗ ${result.error || result.reason}`);
        console.log('    The keys are saved anyway. Check them and the two Security');
        console.log('    switches in EmailJS, then run setup again.\n');
      }
    }
  }
} else {
  console.log('  Skipped — until this is done, no confirmation emails are sent.\n');
}

// 3 --------------------------------------------------------------- finish ---
stop();

if (!changes.length) {
  console.log(`${rule()}\n  Nothing changed.\n${rule()}\n`);
  process.exit(0);
}

await writeFile(ENV_PATH, env, 'utf8');

console.log(rule('═'));
changes.forEach((c) => console.log(`  ✓ ${c}`));
console.log(`\n  Written to .env  (git-ignored — it is never committed)`);
console.log('\n  Now restart the server:   npm start');
console.log(`${rule('═')}\n`);
