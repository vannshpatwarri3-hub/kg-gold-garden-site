/**
 * Tiny JSON-file persistence. No database dependency — the showroom can read,
 * back up, or hand these files to an accountant without any tooling.
 *
 * Writes are serialised through a per-file promise chain so two concurrent
 * requests can't interleave a read-modify-write and lose a record.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const OUTBOX_DIR = path.join(DATA_DIR, 'outbox');

const locks = new Map();

async function withLock(file, fn) {
  const prev = locks.get(file) ?? Promise.resolve();
  let release;
  const next = new Promise((r) => (release = r));
  locks.set(file, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (locks.get(file) === next) locks.delete(file);
  }
}

export async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
}

export async function readJson(name, fallback) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    // A corrupt file should be loud, not silently replaced with defaults.
    throw new Error(`Could not read data/${name}: ${err.message}`);
  }
}

export async function writeJson(name, value) {
  return withLock(name, async () => {
    const target = path.join(DATA_DIR, name);
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tmp, target); // atomic replace — no half-written file
  });
}

/** Read a list, append one record, write it back. Returns the stored record. */
export async function append(name, record) {
  return withLock(name, async () => {
    const target = path.join(DATA_DIR, name);
    let list = [];
    try {
      list = JSON.parse(await fs.readFile(target, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    list.push(record);
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
    await fs.rename(tmp, target);
    return record;
  });
}

/** Persist an email we could not send yet, so nothing is silently lost. */
export async function queueOutbox(message) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = String(message.to || 'unknown').replace(/[^a-z0-9@._-]/gi, '_');
  const file = path.join(OUTBOX_DIR, `${stamp}__${safe}.json`);
  await fs.writeFile(file, JSON.stringify(message, null, 2), 'utf8');
  return file;
}
