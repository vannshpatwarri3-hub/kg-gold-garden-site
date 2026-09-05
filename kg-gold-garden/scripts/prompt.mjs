/**
 * A tiny prompt reader.
 *
 * Node's readline cannot easily hide typed characters, and building a fresh
 * interface per question leaves stdin closed for the next one — which is exactly
 * what made the first version of setup hang after the ID prompt. So this reads
 * stdin once, for the whole run, and echoes characters itself so a password can
 * simply not be echoed.
 *
 * Works both at a real terminal (raw mode, character at a time) and with piped
 * input (line at a time), which is what makes it testable.
 */
const isTTY = Boolean(process.stdin.isTTY);

const queue = []; // questions waiting for a line
const ready = []; // lines read before anything asked for them
let buffer = '';
let started = false;

/**
 * Piped input arrives as one chunk containing every answer at once, while a
 * person types them one at a time. Holding un-consumed lines in `ready` means
 * both cases work — otherwise every answer after the first is thrown away.
 */
function deliver(line) {
  const job = queue.shift();
  if (!job) {
    ready.push(line);
    return;
  }
  process.stdout.write('\n'); // Enter is never echoed for us
  job.resolve(line.trim());
}

function onData(chunk) {
  if (!isTTY) {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).replace(/\r$/, '');
      buffer = buffer.slice(i + 1);
      deliver(line);
    }
    return;
  }

  for (const ch of chunk) {
    if (ch === '') {
      // Ctrl-C
      process.stdout.write('\n');
      stop();
      process.exit(130);
    }
    if (ch === '\r' || ch === '\n') {
      const line = buffer;
      buffer = '';
      deliver(line);
      continue;
    }
    if (ch === '' || ch === '\b') {
      if (buffer.length) {
        buffer = buffer.slice(0, -1);
        if (!queue[0]?.hidden) process.stdout.write('\b \b');
      }
      continue;
    }
    buffer += ch;
    if (!queue[0]?.hidden) process.stdout.write(ch);
  }
}

function start() {
  if (started) return;
  started = true;
  process.stdin.setEncoding('utf8');
  if (isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onData);
  // If input runs out, don't hang forever waiting on a prompt.
  process.stdin.on('end', () => {
    while (queue.length) queue.shift().resolve('');
  });
}

export function stop() {
  if (!started) return;
  process.stdin.removeListener('data', onData);
  if (isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  started = false;
}

/** Ask a question. Pass `hidden` for passwords — nothing is echoed. */
export function question(text, { hidden = false } = {}) {
  start();
  process.stdout.write(text);
  if (ready.length) {
    const line = ready.shift();
    process.stdout.write('\n');
    return Promise.resolve(line.trim());
  }
  return new Promise((resolve) => queue.push({ resolve, hidden }));
}
