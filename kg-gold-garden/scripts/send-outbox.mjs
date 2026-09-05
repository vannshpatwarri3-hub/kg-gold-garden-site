#!/usr/bin/env node
/**
 * Send the mail that was saved while email was switched off.
 *
 *   npm run send-outbox
 *
 * Every message the site could not deliver was written to data/outbox/ rather
 * than dropped. This lists them, asks before sending anything, and deletes each
 * file only once Gmail has accepted it — so a failure part-way through can
 * simply be re-run.
 */
import 'dotenv/config';
import { readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { send, isMailConfigured } from '../server/mailer.js';
import { question, stop } from './prompt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTBOX = path.join(ROOT, 'data', 'outbox');
const rule = (c = '─') => c.repeat(70);

if (!isMailConfigured()) {
  console.error('\n  Email is not switched on yet. Run "npm run setup" first.\n');
  process.exit(1);
}

let files = [];
try {
  files = (await readdir(OUTBOX)).filter((f) => f.endsWith('.json')).sort();
} catch {
  console.log('\n  Nothing queued — there is no outbox folder.\n');
  process.exit(0);
}

if (!files.length) {
  console.log('\n  Nothing queued. Every message has already been sent.\n');
  process.exit(0);
}

// Load them all first so we can show an honest summary before sending anything.
const items = [];
for (const file of files) {
  try {
    const msg = JSON.parse(await readFile(path.join(OUTBOX, file), 'utf8'));
    items.push({ file, msg });
  } catch {
    console.log(`  (skipping ${file} — could not be read)`);
  }
}

const byRecipient = items.reduce((acc, { msg }) => {
  acc[msg.to] = (acc[msg.to] ?? 0) + 1;
  return acc;
}, {});

console.log(`\n${rule('═')}`);
console.log(`  ${items.length} message${items.length === 1 ? '' : 's'} waiting to be sent`);
console.log(rule('═'));
for (const [to, count] of Object.entries(byRecipient)) {
  console.log(`  ${String(count).padStart(3)}  →  ${to}`);
}
console.log(`\n  These were saved while email was switched off. Some may be old, and`);
console.log('  some may be from your own testing — check the list above before sending.\n');

const answer = (await question('  Send them all now? [y/N] ')).toLowerCase();
stop();

if (!answer.startsWith('y')) {
  console.log('\n  Nothing sent. The files are still in data/outbox/.\n');
  process.exit(0);
}

console.log('');
let sent = 0;
let failed = 0;

for (const { file, msg } of items) {
  process.stdout.write(`  → ${msg.to} … `);

  // Remove the file first: send() re-queues anything it cannot deliver, so
  // deleting afterwards would leave two copies of every failure.
  await unlink(path.join(OUTBOX, file));

  // Strip the bookkeeping fields the mailer sets itself.
  const { queuedAt, error, from, ...rest } = msg;
  const result = await send(rest);

  if (result.delivered) {
    sent += 1;
    console.log('sent');
  } else {
    failed += 1;
    console.log(`failed (${result.reason}) — re-queued`);
  }
}

console.log(`\n${rule('═')}`);
console.log(`  Sent ${sent}${failed ? `, ${failed} still waiting — run this again to retry` : ''}.`);
console.log(`${rule('═')}\n`);
