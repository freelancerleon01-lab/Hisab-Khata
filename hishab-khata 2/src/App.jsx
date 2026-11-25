import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Auth from './Auth.jsx';
import Admin from './Admin.jsx';
import Ledger from './Ledger.jsx';
import Profile from './Profile.jsx';
import { AlarmScreen, PrayerTab, useAlarm } from './Prayer.jsx';
import { CashForm, TxList } from './Cash.jsx';
import { B, Head, Ic, dkey, shortDay, tk } from './lib.jsx';
import { applyPalette } from './palettes.js';

const NAV = [['home', 'home', 'হোম'], ['cash', 'list', 'লেনদেন'], ['prayer', 'moon', 'নামাজ'], ['profile', 'user', 'প্রোফাইল']];
const TITLE = { home: 'হিসাব খাতা', cash: 'আয়-খরচ', prayer: 'নামাজের সময়', profile: 'প্রোফাইল', dhar: 'ধার', baki: 'বাকি' };
const TONE = { home: 'var(--pri)', cash: 'var(--pri)', prayer: 'var(--pri)', profile: 'var(--pri)', dhar: 'var(--dhar)', baki: 'var(--baki)' };
const NONE = [];
const sumTx = (list, type) => list.reduce((s, t) => s + (t.type === type ? t.amount : 0), 0);

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = লোড হচ্ছে, null = লগইন নেই
  const [tx, setTx] = useState([]);
  const [led, setLed] = useState([]);
  const [prayer, setPrayer] = useState(null);
  const [tab, setTab] = useState('home');
  const [menu, setMenu] = useState(null);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [, tick] = useState(0);
  const user = session?.user;
  const admin = session?.admin;

  const notify = useCallback((text, ok = false) => setToast({ text, ok }), []);
  const fail = useCallback((e) => {
    if (e.status === 401) { setSession(null); return; }
    notify(e.message);
  }, [notify]);

  useEffect(() => {
    api.me().then((r) => setSession(r)).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.data().then((d) => { setTx(d.transactions); setLed(d.ledger); }).catch(fail);
  }, [user?.id, fail]);

  // নামাজের সময়সূচি: অ্যাডমিনের বদল যেন ব্যবহারকারীর কাছে পৌঁছায়
  useEffect(() => {
    if (!user) return;
    const load = () => api.prayers().then(setPrayer).catch(() => {});
    load();
    const i = setInterval(load, 5 * 60 * 1000);
    const vis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis); };
  }, [user?.id]);

  useEffect(() => { if (user) applyPalette(user.prefs?.theme); }, [user?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    const i = setInterval(() => tick((x) => x + 1), 60000);
    return () => { document.removeEventListener('click', close); clearInterval(i); };
  }, []);

  const alarmsOff = user?.prefs?.alarmsOff || NONE;
  const alarm = useAlarm({ times: prayer?.times || NONE, snooze: prayer?.snooze || 5, alarmsOff });

  const todayKey = dkey(Date.now());
  const day = sel || todayKey;
  const dayTx = useMemo(() => tx.filter((t) => t.date === day), [tx, day]);

  const patchPrefs = (patch) => {
    setSession((s) => ({ user: { ...s.user, prefs: { ...s.user.prefs, ...patch } } }));
    api.prefs(patch).catch(fail);
  };
  const toggleAlarm = (key, on) =>
    patchPrefs({ alarmsOff: on ? alarmsOff.filter((k) => k !== key) : [...new Set([...alarmsOff, key])] });

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
    applyPalette('ocean');
    setSession(null); setTx([]); setLed([]); setPrayer(null); setTab('home'); setSel(null);
  };
  const adminLogout = async () => {
    try { await api.admin.logout(); } catch { /* ignore */ }
    setSession(null);
  };

  if (session === undefined) return <div className="boot">লোড হচ্ছে…</div>;
  if (admin) return <Admin admin={admin} onAdmin={(a) => setSession({ admin: a })} onLogout={adminLogout} />;
  if (!user) return <Auth onAuth={setSession} />;

  const scopedTx = sel ? dayTx : tx;
  const income = sumTx(scopedTx, 'in');
  const expense = sumTx(scopedTx, 'out');
  const balance = income - expense;
  const allBal = sumTx(tx, 'in') - sumTx(tx, 'out');
  const owe = (k) => led.reduce((s, e) =>
    s + (e.kind === k && e.side === 'lent' && (!sel || e.date === day) ? (e.type === 'give' ? e.amount : -e.amount) : 0), 0);
  const recent = sel ? dayTx : tx.slice(0, 5);
  const ledgerTab = tab === 'dhar' || tab === 'baki';
  const lp = { entries: led, onGive: addLed, onRepay: addLed, onDeleteEntry: delLed, onDeletePerson: delPerson, menu, setMenu, day, sel };
  const txp = { menu, setMenu, onDelete: delTx };
  const datePick = tab === 'home' || tab === 'cash' || ledgerTab;

  return (
    <div>
      {alarm.ring && <AlarmScreen ring={alarm.ring} snooze={prayer?.snooze || 5} onStop={alarm.stop} onSnooze={alarm.snooze} />}
      {toast && <div className={'toast' + (toast.ok ? ' good' : '')} role="alert">{toast.text}</div>}
      <div inert={alarm.ring ? '' : undefined}>
        <div className="app">
          <Head title={TITLE[tab]} tone={TONE[tab]} sel={sel} setSel={setSel} today={todayKey} pick={datePick}
            onBack={ledgerTab ? () => setTab('home') : undefined} />

          {tab === 'home' && (
            <div>
              <div className="bal">
                <small>হাতে আছে</small>
                <b>{balance < 0 ? '−' : ''}{tk(Math.abs(balance))}</b>
                <div className="row">
                  <div>মোট আয়<b style={{ color: 'var(--in)' }}>{tk(income)}</b></div>
                  <div>মোট খরচ<b style={{ color: 'var(--out)' }}>{tk(expense)}</b></div>
                </div>
              </div>
              <div className="owed" style={{ marginTop: 10 }}>
                <button onClick={() => setTab('dhar')}><small>ধার পাবেন</small><b style={{ color: 'var(--dhar)' }}>{tk(owe('dhar'))}</b></button>
                <button onClick={() => setTab('baki')}><small>বাকি পাবেন</small><b style={{ color: 'var(--baki)' }}>{tk(owe('baki'))}</b></button>
              </div>
              <h2>নতুন এন্ট্রি</h2>
              <CashForm onAdd={addCash} />
              <h2>{sel ? B(shortDay(day, todayKey) + ' লেনদেন') : 'সাম্প্রতিক লেনদেন'}<button onClick={() => setTab('cash')}>সব দেখুন</button></h2>
              <div className="card"><TxList items={recent} empty={sel ? 'এই দিনে কোনো লেনদেন নেই।' : null} {...txp} /></div>
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

          {tab === 'prayer' && <PrayerTab data={prayer} alarmsOff={alarmsOff} onToggle={toggleAlarm} onTest={alarm.test} />}
          {tab === 'profile' && (
            <Profile user={user} notify={notify} onLogout={logout}
              onUser={(u) => setSession({ user: u })} onTheme={(theme) => patchPrefs({ theme })} />
          )}
          {tab === 'dhar' && <Ledger kind="dhar" {...lp} />}
          {tab === 'baki' && <Ledger kind="baki" {...lp} />}
        </div>

        <nav className="nav">
          <div>
            {NAV.map(([k, i, l]) => {
              const on = tab === k || (k === 'home' && ledgerTab);
              return <button key={k} aria-current={on ? 'page' : undefined} onClick={() => setTab(k)}><Ic n={i} />{l}</button>;
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
