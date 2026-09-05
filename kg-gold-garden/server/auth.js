/**
 * Admin authentication for the rate page.
 *
 * The password is never stored — only a scrypt hash of it, which the owner
 * generates themselves with `npm run set-password` and pastes into .env. Nobody
 * (including whoever set this up) can read the password back out of the repo.
 *
 * A successful login sets a short-lived HMAC-signed, httpOnly cookie. The signing
 * secret is random per boot unless ADMIN_SESSION_SECRET is set, so restarting the
 * server logs everyone out — which is the safe default for a shop counter.
 */
import crypto from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const COOKIE = 'kgg_admin';
const SESSION_MS = 8 * 60 * 60 * 1000; // one working day

const SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

/** `scrypt$<salt hex>$<hash hex>` — safe to commit to .env, not to source. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  let expected;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }

  let actual;
  try {
    actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  } catch {
    return false;
  }

  // Constant-time — a length mismatch alone must not leak through timing.
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function isPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD_HASH);
}

/** The ID shown on the login form. Defaults to "admin" if none was chosen. */
export function adminUsername() {
  return (process.env.ADMIN_USERNAME || 'admin').trim();
}

/** Case-insensitive, and compared in constant time like the password. */
export function verifyUsername(given) {
  const expected = Buffer.from(adminUsername().toLowerCase());
  const actual = Buffer.from(String(given ?? '').trim().toLowerCase());
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// --- sessions ---------------------------------------------------------------

const sign = (payload) =>
  crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

export function createSession() {
  const payload = String(Date.now() + SESSION_MS);
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;

  const expiry = Number(payload);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(value, { clear = false, secure = false } = {}) {
  const bits = [
    `${COOKIE}=${clear ? '' : value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}
