import { randomInt, timingSafeEqual } from 'node:crypto';
import { pool, query } from './db.js';
import * as A from './auth.js';
import { sendOtpMail } from './mail.js';
import { getPrayers, PRAYER_KEYS } from './account.js';
import { send, bad, text, EMAIL, TIME } from './util.js';

const same = (a, b) => timingSafeEqual(Buffer.from(A.sha256(a), 'hex'), Buffer.from(A.sha256(b), 'hex'));
const pub = (a) => ({ id: a.id, username: a.username, email: a.email });

// প্রথমবার: Vercel-এর ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL থেকে অ্যাডমিন তৈরি হয়।
// তৈরি হওয়ার পর শুধু ডাটাবেসের পাসওয়ার্ড চলে, env-এর পাসওয়ার্ড আর কাজ করে না।
async function ensureAdmin(username) {
  const found = await query('select * from admins where lower(username) = $1', [username]);
  if (found.rows[0]) return found.rows[0];
  const envUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const envPass = process.env.ADMIN_PASSWORD || '';
  if (!envUser || envPass.length < 8 || envUser.includes('@') || username !== envUser) return null;
  const count = await query('select count(*)::int as n from admins');
  if (count.rows[0].n > 0) return null;
  const ins = await query(
    'insert into admins (username, email, password_hash) values ($1, $2, $3) on conflict do nothing returning *',
    [envUser, (process.env.ADMIN_EMAIL || '').trim().toLowerCase(), await A.hashPassword(envPass)]
  );
  return ins.rows[0] || (await query('select * from admins where lower(username) = $1', [username])).rows[0] || null;
}

export async function adminLogin(res, username, password) {
  const key = 'admin:' + username;
  const att = await query(`select count(*)::int as n from login_attempts where email = $1 and at > now() - interval '15 minutes'`, [key]);
  if (att.rows[0].n >= 8) return send(res, 429, { error: 'অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।' });
  const admin = await ensureAdmin(username);
  if (!admin || !(await A.verifyPassword(password, admin.password_hash))) {
    await query('insert into login_attempts (email) values ($1)', [key]);
    return send(res, 401, { error: 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।' });
  }
  await query('delete from login_attempts where email = $1', [key]);
  await query('delete from admin_sessions where expires_at < now()');
  await A.createAdminSession(res, admin.id);
  return send(res, 200, { admin: pub(admin) });
}

async function sendOtp(res, body) {
  const username = text(body.username, 40).toLowerCase();
  const admin = username ? await ensureAdmin(username) : null;
  if (admin && admin.email) {
    const c = await query(`select count(*)::int as n from admin_otps where admin_id = $1 and created_at > now() - interval '1 hour'`, [admin.id]);
    if (c.rows[0].n < 3) {
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      await query('update admin_otps set used_at = now() where admin_id = $1 and used_at is null', [admin.id]);
      await query(`insert into admin_otps (admin_id, code_hash, expires_at) values ($1, $2, now() + interval '10 minutes')`, [admin.id, A.sha256(code + admin.id)]);
      try {
        await sendOtpMail(admin.email, admin.username, code);
      } catch (err) {
        console.error('ওটিপি মেইল পাঠানো যায়নি', err);
      }
    }
  }
  return send(res, 200, { ok: true, message: 'রেজিস্টার্ড ইমেইলে ৬ সংখ্যার ওটিপি পাঠানো হয়েছে। কোডটি ১০ মিনিট চলবে।' });
}

async function resetWithOtp(res, body) {
  const username = text(body.username, 40).toLowerCase();
  const otp = text(body.otp, 6);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^\d{6}$/.test(otp)) return bad(res, '৬ সংখ্যার ওটিপি দিন।');
  if (password.length < 8 || password.length > 200) return bad(res, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
  const { rows: ar } = await query('select id from admins where lower(username) = $1', [username]);
  const invalid = () => bad(res, 'ওটিপি ঠিক নয় বা মেয়াদ শেষ হয়েছে।');
  if (!ar[0]) return invalid();
  const adminId = ar[0].id;
  const hash = await A.hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select id, code_hash, attempts from admin_otps where admin_id = $1 and used_at is null and expires_at > now()
       order by created_at desc limit 1 for update`,
      [adminId]
    );
    const row = rows[0];
    if (!row || row.attempts >= 5) {
      if (row) await client.query('update admin_otps set used_at = now() where id = $1', [row.id]);
      await client.query('commit');
      return invalid();
    }
    if (!same(row.code_hash, A.sha256(otp + adminId))) {
      await client.query('update admin_otps set attempts = attempts + 1 where id = $1', [row.id]);
      await client.query('commit');
      return invalid();
    }
    await client.query('update admins set password_hash = $2 where id = $1', [adminId, hash]);
    await client.query('update admin_otps set used_at = now() where admin_id = $1 and used_at is null', [adminId]);
    await client.query('delete from admin_sessions where admin_id = $1', [adminId]);
    await client.query('commit');
    return send(res, 200, { ok: true });
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function savePrayers(res, body) {
  const list = Array.isArray(body.times) ? body.times : [];
  const snooze = Number(body.snooze);
  if (!Number.isInteger(snooze) || snooze < 1 || snooze > 30) return bad(res, 'স্নুজের সময় ১ থেকে ৩০ মিনিটের মধ্যে দিন।');
  for (const t of list) {
    if (!PRAYER_KEYS.includes(t.key) || !TIME.test(t.time) || typeof t.enabled !== 'boolean') return bad(res, 'সময় সঠিক নয়।');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const t of list) await client.query('update prayer_times set at_time = $2, enabled = $3 where code = $1', [t.key, t.time, t.enabled]);
    await client.query(`update app_settings set value = $1 where key = 'snooze_minutes'`, [String(snooze)]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return getPrayers(res);
}

async function checkCurrent(admin, current) {
  const { rows } = await query('select password_hash from admins where id = $1', [admin.id]);
  return A.verifyPassword(typeof current === 'string' ? current : '', rows[0].password_hash);
}

export async function adminRoutes(req, res, parts, body) {
  const [, b] = parts;
  const m = req.method;
  if (b === 'login' && m === 'POST') return adminLogin(res, text(body.username, 40).toLowerCase(), typeof body.password === 'string' ? body.password.slice(0, 200) : '');
  if (b === 'otp' && m === 'POST') return sendOtp(res, body);
  if (b === 'reset' && m === 'POST') return resetWithOtp(res, body);
  if (b === 'logout' && m === 'POST') {
    await A.destroyAdminSession(req, res);
    return send(res, 200, { ok: true });
  }

  const admin = await A.getAdmin(req);
  if (!admin) return send(res, 401, { error: 'আবার লগইন করুন।' });

  if (b === 'stats' && m === 'GET') {
    const { rows } = await query('select count(*)::int as users from users');
    return send(res, 200, rows[0]);
  }
  if (b === 'prayers' && m === 'GET') return getPrayers(res);
  if (b === 'prayers' && m === 'POST') return savePrayers(res, body);
  if (b === 'password' && m === 'POST') {
    const next = typeof body.next === 'string' ? body.next : '';
    if (next.length < 8 || next.length > 200) return bad(res, 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
    if (!(await checkCurrent(admin, body.current))) return send(res, 403, { error: 'বর্তমান পাসওয়ার্ড ঠিক নয়।' });
    await query('update admins set password_hash = $2 where id = $1', [admin.id, await A.hashPassword(next)]);
    await A.deleteOtherAdminSessions(req, admin.id);
    return send(res, 200, { ok: true });
  }
  if (b === 'email' && m === 'POST') {
    const email = text(body.email, 200).toLowerCase();
    if (!EMAIL.test(email)) return bad(res, 'সঠিক ইমেইল দিন।');
    if (!(await checkCurrent(admin, body.current))) return send(res, 403, { error: 'বর্তমান পাসওয়ার্ড ঠিক নয়।' });
    await query('update admins set email = $2 where id = $1', [admin.id, email]);
    return send(res, 200, { admin: { ...pub(admin), email } });
  }
  return send(res, 404, { error: 'পাওয়া যায়নি।' });
}
