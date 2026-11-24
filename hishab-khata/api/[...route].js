import { query } from './_lib/db.js';
import * as A from './_lib/auth.js';

const send = (res, code, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(body);
};
const bad = (res, msg) => send(res, 400, { error: msg });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 1e12 ? Math.round(n * 100) / 100 : null;
};
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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
    if (a === 'logout' && m === 'POST') {
      await A.destroySession(req, res);
      return send(res, 200, { ok: true });
    }

    const user = await A.getUser(req);
    if (!user) return send(res, 401, { error: 'আবার লগইন করুন।' });
    const uid = user.id;

    if (a === 'me' && m === 'GET') return send(res, 200, { user });

    if (a === 'data' && m === 'GET') {
      const [tx, led] = await Promise.all([
        query(`select ${TX} from transactions where user_id = $1 order by occurred_on desc, created_at desc`, [uid]),
        query(`select ${LED} from ledger_entries where user_id = $1 order by occurred_on asc, created_at asc`, [uid])
      ]);
      return send(res, 200, { transactions: tx.rows, ledger: led.rows });
    }

    if (a === 'transactions') {
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
      'insert into users (name, email, password_hash) values ($1, $2, $3) returning id, name, email',
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

  const { rows: att } = await query(
    `select count(*)::int as n from login_attempts where email = $1 and at > now() - interval '15 minutes'`,
    [email]
  );
  if (att[0].n >= 8) return send(res, 429, { error: 'অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।' });

  const { rows } = await query('select id, name, email, password_hash from users where lower(email) = $1', [email]);
  const ok = rows[0] && (await A.verifyPassword(password, rows[0].password_hash));
  if (!ok) {
    await query('insert into login_attempts (email) values ($1)', [email]);
    return send(res, 401, { error: 'ইমেইল বা পাসওয়ার্ড ঠিক নয়।' });
  }
  await query('delete from login_attempts where email = $1 or at < now() - interval \'1 day\'', [email]);
  await query('delete from sessions where expires_at < now()');
  await A.createSession(res, rows[0].id);
  return send(res, 200, { user: { id: rows[0].id, name: rows[0].name, email: rows[0].email } });
}
