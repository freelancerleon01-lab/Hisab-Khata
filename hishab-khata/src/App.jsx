import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Auth from './Auth.jsx';
import Ledger from './Ledger.jsx';
import { CashForm, TxList } from './Cash.jsx';
import { B, Head, Ic, dkey, shortDay, tk } from './lib.jsx';

const NAV = [['home', 'home', 'হোম'], ['cash', 'list', 'লেনদেন'], ['dhar', 'dhar', 'ধার'], ['baki', 'baki', 'বাকি']];
const TITLE = { home: 'হিসাব খাতা', cash: 'আয়-খরচ', dhar: 'ধার', baki: 'বাকি' };
const TONE = { home: 'var(--pri)', cash: 'var(--pri)', dhar: 'var(--dhar)', baki: 'var(--baki)' };
const sumTx = (list, type) => list.reduce((s, t) => s + (t.type === type ? t.amount : 0), 0);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = লোড হচ্ছে, null = লগইন নেই
  const [tx, setTx] = useState([]);
  const [led, setLed] = useState([]);
  const [tab, setTab] = useState('home');
  const [menu, setMenu] = useState(null);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState('');
  const [, tick] = useState(0);

  const fail = useCallback((e) => {
    if (e.status === 401) { setUser(null); return; }
    setError(e.message);
  }, []);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.data().then((d) => { setTx(d.transactions); setLed(d.ledger); }).catch(fail);
  }, [user, fail]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    const i = setInterval(() => tick((x) => x + 1), 60000);
    return () => { document.removeEventListener('click', close); clearInterval(i); };
  }, []);

  const todayKey = dkey(Date.now());
  const day = sel || todayKey;

  const dayTx = useMemo(() => tx.filter((t) => t.date === day), [tx, day]);
  const scopedTx = sel ? dayTx : tx;
  const income = sumTx(scopedTx, 'in');
  const expense = sumTx(scopedTx, 'out');
  const allBal = sumTx(tx, 'in') - sumTx(tx, 'out');
  const owe = (k) => led.reduce((s, e) =>
    s + (e.kind === k && e.side === 'lent' && (!sel || e.date === day) ? (e.type === 'give' ? e.amount : -e.amount) : 0), 0);

  const run = async (fn) => { try { await fn(); return true; } catch (e) { fail(e); return false; } };

  const addCash = (type, amount, note) =>
    run(async () => { const row = await api.addTx({ type, amount, note, date: todayKey }); setTx((p) => [row, ...p]); });
  const addLed = (entry) =>
    run(async () => { const row = await api.addLed({ ...entry, date: todayKey }); setLed((p) => [...p, row]); });
  const delTx = (t) => run(async () => { await api.delTx(t.id); setTx((p) => p.filter((x) => x.id !== t.id)); });
  const delLed = (id) => run(async () => { await api.delLed(id); setLed((p) => p.filter((x) => x.id !== id)); });
  const delPerson = (kind, side, name) =>
    run(async () => { await api.delPerson(kind, side, name); setLed((p) => p.filter((e) => !(e.kind === kind && e.side === side && e.name === name))); });

  const logout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null); setTx([]); setLed([]); setTab('home'); setSel(null);
  };

  if (user === undefined) return <div className="boot">লোড হচ্ছে…</div>;
  if (!user) return <Auth onAuth={setUser} />;

  const balance = income - expense;
  const recent = sel ? dayTx : tx.slice(0, 5);
  const lp = { entries: led, onGive: addLed, onRepay: addLed, onDeleteEntry: delLed, onDeletePerson: delPerson, menu, setMenu, day, sel };
  const txp = { menu, setMenu, onDelete: delTx };

  return (
    <div>
      {error && <div className="toast" role="alert">{error}</div>}
      <div className="app">
        <Head title={TITLE[tab]} tone={TONE[tab]} sel={sel} setSel={setSel} today={todayKey} />

        {tab === 'home' && (
          <div>
            <div className="bal">
              <small>{sel ? 'হাতে আছে (সেদিনের আয় − খরচ)' : 'হাতে আছে (আয় − খরচ)'}</small>
              <b>{balance < 0 ? '−' : ''}{tk(Math.abs(balance))}</b>
              <div className="row"><div>মোট আয়<b>{tk(income)}</b></div><div>মোট খরচ<b>{tk(expense)}</b></div></div>
            </div>
            <div className="owed" style={{ marginTop: 10 }}>
              <button onClick={() => setTab('dhar')}><small>ধার পাবেন</small><b style={{ color: 'var(--dhar)' }}>{tk(owe('dhar'))}</b></button>
              <button onClick={() => setTab('baki')}><small>বাকি পাবেন</small><b style={{ color: 'var(--baki)' }}>{tk(owe('baki'))}</b></button>
            </div>
            <h2>নতুন এন্ট্রি</h2>
            <CashForm onAdd={addCash} />
            <h2>{sel ? B(shortDay(day, todayKey) + ' লেনদেন') : 'সাম্প্রতিক লেনদেন'}<button onClick={() => setTab('cash')}>সব দেখুন</button></h2>
            <div className="card"><TxList items={recent} empty={sel ? 'এই দিনে কোনো লেনদেন নেই।' : null} {...txp} /></div>
            <div className="foot"><span>{user.name}</span><button onClick={logout}>বের হোন</button></div>
          </div>
        )}

        {tab === 'cash' && (
          <div>
            <div className="hero"><small>হাতে আছে</small><b>{allBal < 0 ? '−' : ''}{tk(Math.abs(allBal))}</b></div>
            <h2>
              <span>{B(shortDay(day, todayKey) + ' লেনদেন')}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)' }}>আয় {tk(sumTx(dayTx, 'in'))} · খরচ {tk(sumTx(dayTx, 'out'))}</span>
            </h2>
            <div className="card"><TxList items={dayTx} empty="এই দিনে কোনো লেনদেন নেই।" {...txp} /></div>
          </div>
        )}

        {tab === 'dhar' && <Ledger kind="dhar" {...lp} />}
        {tab === 'baki' && <Ledger kind="baki" {...lp} />}
      </div>

      <nav className="nav">
        <div>
          {NAV.map(([k, i, l]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><Ic n={i} />{l}</button>
          ))}
        </div>
      </nav>
    </div>
  );
}
