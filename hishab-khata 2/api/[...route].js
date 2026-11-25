import { randomBytes } from 'node:crypto';
import { pool, query } from './_lib/db.js';
import { baseUrl, sendResetMail } from './_lib/mail.js';
import * as A from './_lib/auth.js';

import { send, bad, UUID, EMAIL, isDate, money, text } from './_lib/util.js';
import { adminLogin, adminRoutes } from './_lib/admin.js';
import { changePassword, getPrayers, updatePrefs, updateProfile } from './_lib/account.js';

const TX = `id, type, amount::float8 as amount, note, to_char(occurred_on, 'YYYY-MM-DD') as date`;
const LED = `id, kind, side, type, person_name as name, amount::float8 as amount, item, to_char(occurred_on, 'YYYY-MM-DD') as date`;

export default async function handler(req, res) {
  try {
    const parts = new URL(req.url, 'http://x').pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const [a, b] = parts;
    const m = req.method;
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (m !== 'GET' && !A.sameOrigin(req)) return send(res, 403, { error: 'অনুরোধটি অনুমোদিত নয়।' });

    if (a === 'signup' && m === 'POST') return signup(res, body);
    if (a === 'login' && m === 'POST') return login(res, body);
    if (a === 'forgot' && m === 'POST') return forgot(res, body);
    if (a === 'reset' && m === 'POST') return resetPassword(res, body);
    if (a === 'admin') return adminRoutes(req, res, parts, body);
    if (a === 'me' && m === 'GET') {
      const u = await A.getUser(req);
      if (u) return send(res, 200, { user: u });
      const ad = await A.getAdmin(req);
      if (ad) return send(res, 200, { admin: { id: ad.id, username: ad.username, email: ad.email } });
      return send(res, 401, { error: 'আবার লগইন করুন।' });
    }
    if (a === 'logout' && m === 'POST') {
      await A.destroySession(req, res);
      return send(res, 200, { ok: true });
    }

    const user = await A.getUser(req);
    if (!user) return send(res, 401, { error: 'আবার লগইন করুন।' });
    const uid = user.id;

    if (a === 'prayers' && m === 'GET') return getPrayers(res);
    if (a === 'profile' && m === 'POST') return updateProfile(res, user, body);
    if (a === 'password' && m === 'POST') return changePassword(req, res, user, body);
    if (a === 'prefs' && m === 'POST') return updatePrefs(res, user, body);

    if (a === 'data' && m === 'GET') {
      const [tx, led] = await Promise.all([
        query(`select ${TX} from transactions where user_id = $1 order by occurred_on desc, created_at desc`, [uid]),
        query(`select ${LED} from ledger_entries where user_id = $1 order by occurred_on asc, created_at asc`, [uid])
      ]);
      return send(res, 200, { transactions: tx.rows, ledger: led.rows });
    }

    if (a === 'transactions') {
      if (m === 'POST' && b === 'delete') {
        if (!UUID.test(String(body.id || ''))) return bad(res, 'তথ্য সঠিক নয়।');
        await query('delete from transactions where id = $1 and user_id = $2', [body.id, uid]);
        return send(res, 200, { ok: true });
      }
      if (m === 'POST') {
        const amount = money(body.amount);
        if (!['in', 'out'].includes(body.type) || !amount || !isDate(body.date)) return bad(res, 'তথ্য সঠিক নয়।');
        const { rows } = await query(
          `insert into transactions (user_id, type, amount, note, occurred_on) values ($1, $2, $3, $4, $5) returning ${TX}`,
          [uid, body.type, amount, text(body.note, 200), body.date]
        );
        return send(res, 201, rows[0]);
      }
      if (m === 'DELETE' && UUID.test(b || '')) {
        await query('delete from transactions where id = $1 and user_id = $2', [b, uid]);
        return send(res, 200, { ok: true });
      }
    }

    if (a === 'ledger') {
      if (m === 'POST' && b === 'delete') {
        if (!UUID.test(String(body.id || ''))) return bad(res, 'তথ্য সঠিক নয়।');
        await query('delete from ledger_entries where id = $1 and user_id = $2', [body.id, uid]);
        return send(res, 200, { ok: true });
      }
      if (m === 'POST' && b === 'delete-person') {
        const name = text(body.name, 60);
        if (!['dhar', 'baki'].includes(body.kind) || !['lent', 'borrowed'].includes(body.side) || !name) return bad(res, 'তথ্য সঠিক নয়।');
        await query('delete from ledger_entries where user_id = $1 and kind = $2 and side = $3 and person_name = $4', [uid, body.kind, body.side, name]);
        return send(res, 200, { ok: true });
      }
      if (m === 'POST') {
        const amount = money(body.amount);
        const name = text(body.name, 60);
        if (!['dhar', 'baki'].includes(body.kind) || !['lent', 'borrowed'].includes(body.side) ||
            !['give', 'repay'].includes(body.type) || !name || !amount || !isDate(body.date)) {
          return bad(res, 'তথ্য সঠিক নয়।');
        }
        if (body.type === 'repay') {
          const { rows } = await query(
            `select coalesce(sum(case when type = 'give' then amount else -amount end), 0)::float8 as due
             from ledger_entries where user_id = $1 and kind = $2 and side = $3 and person_name = $4`,
            [uid, body.kind, body.side, name]
          );
          if (amount > rows[0].due + 0.001) return bad(res, 'পরিশোধের পরিমাণ বকেয়ার চেয়ে বেশি হতে পারে না।');
        }
        const { rows } = await query(
          `insert into ledger_entries (user_id, kind, side, type, person_name, amount, item, occurred_on)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${LED}`,
          [uid, body.kind, body.side, body.type, name, amount, text(body.item, 200), body.date]
        );
        return send(res, 201, rows[0]);
      }
      if (m === 'DELETE' && b === 'person') {
        const q = new URL(req.url, 'http://x').searchParams;
        const [kind, side, name] = [q.get('kind'), q.get('side'), text(q.get('name') || '', 60)];
        if (!['dhar', 'baki'].includes(kind) || !['lent', 'borrowed'].includes(side) || !name) return bad(res, 'তথ্য সঠিক নয়।');
        await query('delete from ledger_entries where user_id = $1 and kind = $2 and side = $3 and person_name = $4', [uid, kind, side, name]);
        return send(res, 200, { ok: true });
      }
      if (m === 'DELETE' && UUID.test(b || '')) {
        await query('delete from ledger_entries where id = $1 and user_id = $2', [b, uid]);
        return send(res, 200, { ok: true });
      }
    }

    return send(res, 404, { error: 'পাওয়া যায়নি।' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে, একটু পরে আবার চেষ্টা করুন।' });
  }
}

async function signup(res, body) {
  const name = text(body.name, 60);
  const email = text(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name) return bad(res, 'আপনার নাম লিখুন।');
  if (!EMAIL.test(email)) return bad(res, 'সঠিক ইমেইল দিন।');
  if (password.length < 8 || password.length > 200) return bad(res, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
  try {
    const { rows } = await query(
      'insert into users (name, email, password_hash) values ($1, $2, $3) returning id, name, email, prefs',
      [name, email, await A.hashPassword(password)]
    );
    await A.createSession(res, rows[0].id);
    return send(res, 201, { user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return send(res, 409, { error: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে।' });
    throw err;
  }
}

async function login(res, body) {
  const email = text(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (!email || !password) return bad(res, 'ইমেইল ও পাসওয়ার্ড দিন।');
  if (!email.includes('@')) return adminLogin(res, email, password);

  const { rows: att } = await query(
    `select count(*)::int as n from login_attempts where email = $1 and at > now() - interval '15 minutes'`,
    [email]
  );
  if (att[0].n >= 8) return send(res, 429, { error: 'অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।' });

  const { rows } = await query('select id, name, email, prefs, password_hash from users where lower(email) = $1', [email]);
  const ok = rows[0] && (await A.verifyPassword(password, rows[0].password_hash));
  if (!ok) {
    await query('insert into login_attempts (email) values ($1)', [email]);
    return send(res, 401, { error: 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।' });
  }
  await query('delete from login_attempts where email = $1 or at < now() - interval \'1 day\'', [email]);
  await query('delete from sessions where expires_at < now()');
  await A.createSession(res, rows[0].id);
  return send(res, 200, { user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, prefs: rows[0].prefs } });
}

// ইমেইল আছে কি না তা বাইরে থেকে বোঝা যায় না: সব ক্ষেত্রেই একই উত্তর
async function forgot(res, body) {
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return bad(res, 'সঠিক ইমেইল দিন।');
  const { rows } = await query('select id, name, email from users where lower(email) = $1', [email]);
  const u = rows[0];
  if (u) {
    const { rows: c } = await query(
      `select count(*)::int as n from password_resets where user_id = $1 and created_at > now() - interval '1 hour'`,
      [u.id]
    );
    if (c[0].n < 3) {
      const token = randomBytes(32).toString('base64url');
      await query(
        `insert into password_resets (user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 hour')`,
        [u.id, A.sha256(token)]
      );
      try {
        await sendResetMail(u, `${baseUrl()}/?reset=${token}`);
      } catch (err) {
        console.error('রিসেট মেইল পাঠানো যায়নি', err);
      }
    }
  }
  return send(res, 200, { ok: true, message: 'এই ইমেইলে অ্যাকাউন্ট থাকলে রিসেট লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।' });
}

async function resetPassword(res, body) {
  const token = typeof body.token === 'string' ? body.token.slice(0, 100) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8 || password.length > 200) return bad(res, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
  const hash = await A.hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select user_id from password_resets where token_hash = $1 and used_at is null and expires_at > now() for update`,
      [A.sha256(token)]
    );
    if (!rows[0]) {
      await client.query('rollback');
      return bad(res, 'লিংকটির মেয়াদ শেষ বা আগেই ব্যবহার করা হয়েছে। নতুন লিংক চেয়ে নিন।');
    }
    const uid = rows[0].user_id;
    await client.query('update users set password_hash = $1 where id = $2', [hash, uid]);
    await client.query('update password_resets set used_at = now() where user_id = $1 and used_at is null', [uid]);
    await client.query('delete from sessions where user_id = $1', [uid]);
    await client.query('commit');
    return send(res, 200, { ok: true });
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
