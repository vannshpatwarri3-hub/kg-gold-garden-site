#!/usr/bin/env node
/**
 * Generate the admin password hash.
 *
 *   npm run set-password
 *
 * Type the password you want at the prompt — it is not echoed, not stored, and
 * not sent anywhere. The script prints one line to paste into your .env file.
 */
import readline from 'node:readline';
import { hashPassword } from '../server/auth.js';

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    // Suppress echo so the password never appears on screen or in scrollback.
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) return;
      readline.moveCursor(process.stdout, -1000, 0);
      readline.clearLine(process.stdout, 1);
      process.stdout.write(question + '*'.repeat(rl.line.length));
    };
    process.stdin.on('data', onData);

    rl.question(question, (answer) => {
      process.stdin.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const first = await askHidden('Choose an admin password: ');

if (first.length < 8) {
  console.error('\nToo short — please use at least 8 characters.');
  process.exit(1);
}

const second = await askHidden('Type it once more:       ');

if (first !== second) {
  console.error('\nThose did not match. Nothing was changed.');
  process.exit(1);
}

const rule = '─'.repeat(72);
console.log(`\n${rule}`);
console.log('  Add this line to your .env file (create it from .env.example):\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(first)}`);
console.log(`\n  Then restart the server. Open /admin and log in with the password`);
console.log('  you just chose. The password itself is not stored anywhere.');
console.log(`${rule}\n`);
