import { query } from './db.js';
import * as A from './auth.js';
import { send, bad, text, EMAIL } from './util.js';

export const PRAYER_KEYS = ['fajr', 'dhuhr', 'jumua', 'asr', 'maghrib', 'isha'];
const PALETTES = ['ocean', 'blue', 'green', 'violet', 'sunset', 'rose'];

export async function getPrayers(res) {
  const [t, s] = await Promise.all([
    query('select code as key, label, at_time as time, enabled from prayer_times order by sort'),
    query(`select value from app_settings where key = 'snooze_minutes'`)
  ]);
  return send(res, 200, { times: t.rows, snooze: Number(s.rows[0]?.value || 5) });
}

export async function updatePrefs(res, user, body) {
  const patch = {};
  if (body.theme !== undefined) {
    if (!PALETTES.includes(body.theme)) return bad(res, 'থিম সঠিক নয়।');
    patch.theme = body.theme;
  }
  if (body.alarmsOff !== undefined) {
    if (!Array.isArray(body.alarmsOff) || !body.alarmsOff.every((k) => PRAYER_KEYS.includes(k))) return bad(res, 'তথ্য সঠিক নয়।');
    patch.alarmsOff = [...new Set(body.alarmsOff)];
  }
  const { rows } = await query('update users set prefs = prefs || $2::jsonb where id = $1 returning prefs', [user.id, JSON.stringify(patch)]);
  return send(res, 200, { prefs: rows[0].prefs });
}

export async function updateProfile(res, user, body) {
  const name = text(body.name, 60);
  const email = text(body.email, 200).toLowerCase();
  if (!name) return bad(res, 'নাম লিখুন।');
  if (!EMAIL.test(email)) return bad(res, 'সঠিক ইমেইল দিন।');
  if (email !== user.email.toLowerCase()) {
    const { rows } = await query('select password_hash from users where id = $1', [user.id]);
    const ok = await A.verifyPassword(typeof body.currentPassword === 'string' ? body.currentPassword : '', rows[0].password_hash);
    if (!ok) return send(res, 403, { error: 'ইমেইল বদলাতে বর্তমান পাসওয়ার্ড সঠিকভাবে দিন।' });
  }
  try {
    const { rows } = await query('update users set name = $2, email = $3 where id = $1 returning id, name, email, prefs', [user.id, name, email]);
    return send(res, 200, { user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return send(res, 409, { error: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে।' });
    throw err;
  }
}

export async function changePassword(req, res, user, body) {
  const next = typeof body.next === 'string' ? body.next : '';
  if (next.length < 8 || next.length > 200) return bad(res, 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
  const { rows } = await query('select password_hash from users where id = $1', [user.id]);
  if (!(await A.verifyPassword(typeof body.current === 'string' ? body.current : '', rows[0].password_hash))) {
    return send(res, 403, { error: 'বর্তমান পাসওয়ার্ড ঠিক নয়।' });
  }
  await query('update users set password_hash = $2 where id = $1', [user.id, await A.hashPassword(next)]);
  await A.deleteOtherUserSessions(req, user.id);
  return send(res, 200, { ok: true });
}
