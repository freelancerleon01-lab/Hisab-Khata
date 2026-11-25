import React, { useState } from 'react';
import { api } from './api.js';
import { Ic } from './lib.jsx';
import { PALETTES, applyPalette } from './palettes.js';

export default function Profile({ user, onUser, onTheme, onLogout, notify }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState('');
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const theme = user.prefs?.theme || 'ocean';

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); notify(okMsg, true); } catch (e) { notify(e.message); }
    setBusy('');
  };

  const saveProfile = (e) => {
    e.preventDefault();
    run('p', async () => {
      const { user: u } = await api.profile({ name, email, currentPassword: cur });
      onUser(u); setCur('');
    }, 'প্রোফাইল সংরক্ষিত হয়েছে।');
  };
  const savePw = (e) => {
    e.preventDefault();
    run('w', async () => { await api.password(pw); setPw({ current: '', next: '' }); }, 'পাসওয়ার্ড বদলানো হয়েছে।');
  };
  const pick = (id) => { applyPalette(id); onTheme(id); };

  return (
    <div>
      <h2>আমার তথ্য</h2>
      <form className="card pad" onSubmit={saveProfile}>
        <label htmlFor="pn">নাম</label>
        <input id="pn" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="pe">ইমেইল</label>
        <input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {emailChanged && (
          <>
            <label htmlFor="pc">বর্তমান পাসওয়ার্ড</label>
            <input id="pc" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
          </>
        )}
        <button className="go" disabled={busy === 'p'} style={{ '--c': 'var(--pri)' }}>সংরক্ষণ করুন</button>
      </form>

      <h2>কালার থিম</h2>
      <div className="card pad">
        <div className="pal">
          {PALETTES.map((p) => (
            <button key={p.id} aria-pressed={theme === p.id} onClick={() => pick(p.id)}>
              <i style={{ background: p.swatch }}>{theme === p.id && <Ic n="check" />}</i>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <h2>পাসওয়ার্ড বদলান</h2>
      <form className="card pad" onSubmit={savePw}>
        <label htmlFor="w1">বর্তমান পাসওয়ার্ড</label>
        <input id="w1" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
        <label htmlFor="w2">নতুন পাসওয়ার্ড</label>
        <input id="w2" type="password" autoComplete="new-password" minLength={8} placeholder="কমপক্ষে ৮ অক্ষর" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
        <button className="go" disabled={busy === 'w'} style={{ '--c': 'var(--pri)' }}>পাসওয়ার্ড বদলান</button>
      </form>

      <div className="foot"><span>{user.email}</span><button onClick={onLogout}>বের হোন</button></div>
    </div>
  );
}
