#!/usr/bin/env node
/**
 * Guided setup:  npm run setup
 *
 *   1. the admin ID and password for the rate page
 *   2. the Gmail App Password that lets the site actually send email
 *
 * Nothing you type is echoed to the screen, written to your shell history, or
 * sent anywhere. The password is stored only as a scrypt hash; the App Password
 * is written straight into .env, which is git-ignored.
 */
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { hashPassword } from '../server/auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const PRIMARY = 'primeplay345@gmail.com';
const rule = (c = '─') => c.repeat(70);

// --- prompts ----------------------------------------------------------------

const muted = new Writable({
  write(chunk, enc, cb) {
    if (!muted.hidden) process.stdout.write(chunk, enc);
    cb();
  },
});
muted.hidden = false;

function ask(question, fallback = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
    rl.question('', (answer) => {
      muted.hidden = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
    muted.hidden = true;
  });
}

const yes = async (question, def = true) => {
  const a = (await ask(`${question} ${def ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
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
  const id = await ask('  Admin ID [admin]: ', 'admin');

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
console.log(`${rule()}\n  2. Email  (sending from ${PRIMARY})\n${rule()}`);
console.log(`
  Gmail will not accept your normal password here. You need a 16-character
  "App Password", which is free and takes about a minute:

    1. Turn on 2-Step Verification (required before app passwords exist):
       https://myaccount.google.com/signinoptions/two-step-verification

    2. Create the App Password:
       https://myaccount.google.com/apppasswords
       Choose "Mail" → "Other", name it "KG Gold Garden website".

    3. Google shows 16 letters like  abcd efgh ijkl mnop
       Paste them below. Spaces do not matter.
`);

if (await yes('Do you have the App Password ready?', false)) {
  const appPassword = (await askHidden('  App Password: ')).replace(/\s+/g, '');

  if (appPassword.length < 16) {
    console.log(`\n  ✗ That is ${appPassword.length} characters — an App Password is 16.`);
    console.log('    Nothing was saved for email. Run setup again when you have it.\n');
  } else {
    process.stdout.write('\n  Checking it with Gmail… ');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: PRIMARY, pass: appPassword },
    });

    try {
      await transporter.verify();
      console.log('accepted.');

      env = upsert(env, 'SMTP_USER', PRIMARY);
      env = upsert(env, 'SMTP_PASS', appPassword);
      changes.push('Email switched on and verified with Gmail.');

      if (await yes('  Send a test email to confirm it arrives?')) {
        await transporter.sendMail({
          from: `"KG Gold Garden" <${PRIMARY}>`,
          to: PRIMARY,
          subject: 'KG Gold Garden — email is working',
          text:
            'This is a test from your own website.\n\n' +
            'If you are reading this, email is set up correctly. Rate-alert welcome\n' +
            'notes and appointment confirmations will now be delivered to customers\n' +
            'instead of being saved and held.\n\n— KG Gold Garden website',
        });
        console.log(`  ✓ Sent. Check the inbox for ${PRIMARY}.`);
      }
      console.log('');
    } catch (err) {
      console.log('rejected.');
      console.log(`\n  ✗ Gmail would not accept it: ${err.message}`);
      console.log('    Most often this means 2-Step Verification is not on yet, or a');
      console.log('    character was mistyped. Nothing was saved for email.\n');
    }
  }
} else {
  console.log('  Skipped — the site keeps saving mail to data/outbox/ until you do this.\n');
}

// 3 --------------------------------------------------------------- finish ---
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
