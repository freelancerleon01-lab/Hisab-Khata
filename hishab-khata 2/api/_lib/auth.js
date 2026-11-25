import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';

const scryptAsync = promisify(scrypt);
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

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

// ব্যবহারকারী ও অ্যাডমিনের সেশন আলাদা টেবিল ও আলাদা কুকিতে থাকে
const USER = { cookie: 'hk_session', table: 'sessions', col: 'user_id', secs: 60 * 60 * 24 * 30 };
const ADMIN = { cookie: 'hk_admin', table: 'admin_sessions', col: 'admin_id', secs: 60 * 60 * 12 };

function readToken(req, cfg) {
  const m = new RegExp(`(?:^|;\\s*)${cfg.cookie}=([^;]+)`).exec(req.headers.cookie || '');
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(res, cfg, value, maxAge) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cfg.cookie}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

async function create(res, cfg, id) {
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into ${cfg.table} (${cfg.col}, token_hash, expires_at) values ($1, $2, now() + make_interval(secs => $3))`,
    [id, sha256(token), cfg.secs]
  );
  setCookie(res, cfg, token, cfg.secs);
}

async function destroy(req, res, cfg) {
  const token = readToken(req, cfg);
  if (token) await query(`delete from ${cfg.table} where token_hash = $1`, [sha256(token)]);
  setCookie(res, cfg, '', 0);
}

async function destroyOthers(req, cfg, id) {
  const token = readToken(req, cfg);
  await query(`delete from ${cfg.table} where ${cfg.col} = $1 and token_hash <> $2`, [id, token ? sha256(token) : '']);
}

export const createSession = (res, userId) => create(res, USER, userId);
export const destroySession = (req, res) => destroy(req, res, USER);
export const deleteOtherUserSessions = (req, userId) => destroyOthers(req, USER, userId);
export const createAdminSession = (res, adminId) => create(res, ADMIN, adminId);
export const destroyAdminSession = (req, res) => destroy(req, res, ADMIN);
export const deleteOtherAdminSessions = (req, adminId) => destroyOthers(req, ADMIN, adminId);

export async function getUser(req) {
  const token = readToken(req, USER);
  if (!token) return null;
  const { rows } = await query(
    `select u.id, u.name, u.email, u.prefs from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)]
  );
  return rows[0] || null;
}

export async function getAdmin(req) {
  const token = readToken(req, ADMIN);
  if (!token) return null;
  const { rows } = await query(
    `select a.id, a.username, a.email from admin_sessions s join admins a on a.id = s.admin_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)]
  );
  return rows[0] || null;
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
