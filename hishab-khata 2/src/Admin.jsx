import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { B, Head, bnNum, dkey } from './lib.jsx';

export default function Admin({ admin, onAdmin, onLogout }) {
  const [times, setTimes] = useState(null);
  const [snooze, setSnooze] = useState(5);
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [busy, setBusy] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [em, setEm] = useState({ email: admin.email || '', current: '' });

  const say = (text, ok = false) => setMsg({ text, ok });
  useEffect(() => {
    api.admin.prayers().then((d) => { setTimes(d.times); setSnooze(d.snooze); }).catch((e) => say(e.message));
    api.admin.stats().then((d) => setUsers(d.users)).catch(() => {});
  }, []);

  const run = async (key, fn, ok) => {
    setBusy(key); say('');
    try { await fn(); say(ok, true); } catch (e) { say(e.message); }
    setBusy('');
  };
  const edit = (key, patch) => setTimes((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const save = () => run('s', async () => {
    const d = await api.admin.savePrayers({ times: times.map(({ key, time, enabled }) => ({ key, time, enabled })), snooze: Number(snooze) });
    setTimes(d.times); setSnooze(d.snooze);
  }, 'সময়সূচি সংরক্ষিত হয়েছে। ব্যবহারকারীদের অ্যাপে কয়েক মিনিটের মধ্যে নতুন সময় আসবে।');

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <Head title="অ্যাডমিন প্যানেল" tone="var(--pri)" today={dkey(Date.now())} pick={false} />
      {msg.text && <div className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</div>}

      <div className="hero stat"><small>মোট ব্যবহারকারী</small><b>{users === null ? '…' : B(bnNum(users))}</b></div>

      <h2>নামাজের সময়সূচি ও অ্যালার্ম</h2>
      <div className="card pad">
        {!times ? <div className="empty">লোড হচ্ছে…</div> : times.map((t) => (
          <div className="pr" key={t.key}>
            <div><span className="t">{t.label}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input className="time-in" type="time" value={t.time} onChange={(e) => e.target.value && edit(t.key, { time: e.target.value })} aria-label={t.label + ' সময়'} />
              <label className="sw" aria-label={t.label + ' চালু'}>
                <input type="checkbox" checked={t.enabled} onChange={(e) => edit(t.key, { enabled: e.target.checked })} /><i />
              </label>
            </div>
          </div>
        ))}
        <div className="pr" style={{ borderBottom: 0 }}>
          <span className="t">স্নুজ (মিনিট)</span>
          <input className="time-in amtin" style={{ width: 80 }} type="number" min="1" max="30" value={snooze} onChange={(e) => setSnooze(e.target.value)} />
        </div>
        <button className="go" disabled={busy === 's' || !times} style={{ '--c': 'var(--pri)' }} onClick={save}>সংরক্ষণ করুন</button>
      </div>

      <h2>পাসওয়ার্ড বদলান</h2>
      <form className="card pad" onSubmit={(e) => { e.preventDefault(); run('w', async () => { await api.admin.password(pw); setPw({ current: '', next: '' }); }, 'পাসওয়ার্ড বদলানো হয়েছে।'); }}>
        <label htmlFor="a1">বর্তমান পাসওয়ার্ড</label>
        <input id="a1" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
        <label htmlFor="a2">নতুন পাসওয়ার্ড</label>
        <input id="a2" type="password" autoComplete="new-password" minLength={8} placeholder="কমপক্ষে ৮ অক্ষর" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
        <button className="go" disabled={busy === 'w'} style={{ '--c': 'var(--pri)' }}>পাসওয়ার্ড বদলান</button>
      </form>

      <h2>ওটিপি পাওয়ার ইমেইল</h2>
      <form className="card pad" onSubmit={(e) => { e.preventDefault(); run('e', async () => { const r = await api.admin.email(em); onAdmin(r.admin); setEm({ ...em, current: '' }); }, 'ইমেইল সংরক্ষিত হয়েছে।'); }}>
        <label htmlFor="e1">ইমেইল</label>
        <input id="e1" type="email" value={em.email} onChange={(e) => setEm({ ...em, email: e.target.value })} required />
        <label htmlFor="e2">বর্তমান পাসওয়ার্ড</label>
        <input id="e2" type="password" autoComplete="current-password" value={em.current} onChange={(e) => setEm({ ...em, current: e.target.value })} required />
        <button className="go" disabled={busy === 'e'} style={{ '--c': 'var(--pri)' }}>সংরক্ষণ করুন</button>
      </form>

      <div className="foot"><span>{admin.username}</span><button onClick={onLogout}>বের হোন</button></div>
    </div>
  );
}
