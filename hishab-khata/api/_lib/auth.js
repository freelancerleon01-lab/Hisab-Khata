import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';

const scryptAsync = promisify(scrypt);
const COOKIE = 'hk_session';
const MAX_AGE = 60 * 60 * 24 * 30; // ৩০ দিন

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function createSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 days')`,
    [userId, sha256(token)]
  );
  setCookie(res, token, MAX_AGE);
}

export async function destroySession(req, res) {
  const token = readToken(req);
  if (token) await query('delete from sessions where token_hash = $1', [sha256(token)]);
  setCookie(res, '', 0);
}

export async function getUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const { rows } = await query(
    `select u.id, u.name, u.email from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)]
  );
  return rows[0] || null;
}

function readToken(req) {
  const m = /(?:^|;\s*)hk_session=([^;]+)/.exec(req.headers.cookie || '');
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(res, value, maxAge) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

// অন্য সাইট থেকে আসা লেখার অনুরোধ (CSRF) আটকাতে
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host);
  } catch {
    return false;
  }
}
