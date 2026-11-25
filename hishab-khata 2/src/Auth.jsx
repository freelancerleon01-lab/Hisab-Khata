import React, { useState } from 'react';
import { api } from './api.js';

const resetToken = () => new URLSearchParams(window.location.search).get('reset');
const EMPTY = { name: '', email: '', password: '', again: '', otp: '' };

export default function Auth({ onAuth }) {
  const [token] = useState(resetToken);
  const [mode, setMode] = useState(token ? 'reset' : 'login'); // login | signup | forgot | reset | otp
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = (m) => { setMode(m); setErr(''); setNotice(''); };
  const done = (msg) => { setF(EMPTY); setMode('login'); setNotice(msg); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setNotice('');
    if ((mode === 'reset' || mode === 'otp') && f.password !== f.again) return setErr('দুই জায়গার পাসওয়ার্ড মিলছে না।');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        if (f.email.includes('@')) {
          const r = await api.forgot({ email: f.email });
          setNotice(r.message);
        } else {
          const r = await api.admin.otp({ username: f.email });
          setNotice(r.message);
          setMode('otp');
        }
      } else if (mode === 'otp') {
        await api.admin.reset({ username: f.email, otp: f.otp, password: f.password });
        done('পাসওয়ার্ড বদলানো হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
      } else if (mode === 'reset') {
        await api.reset({ token, password: f.password });
        window.history.replaceState(null, '', '/');
        done('পাসওয়ার্ড বদলানো হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
      } else {
        const r = mode === 'signup' ? await api.signup(f) : await api.login({ email: f.email, password: f.password });
        onAuth(r);
        return;
      }
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  };

  const signup = mode === 'signup';
  const title = { login: 'লগইন করুন', signup: 'অ্যাকাউন্ট খুলুন', forgot: 'এগিয়ে যান', reset: 'পাসওয়ার্ড বদলান', otp: 'পাসওয়ার্ড বদলান' }[mode];
  const newPw = mode === 'reset' || mode === 'otp';

  return (
    <div className="auth">
      <div className="head" style={{ '--t': 'var(--pri)' }}>
        <h1>হিসাব খাতা</h1>
        <p>আপনার আয়, খরচ, ধার ও বাকির হিসাব, শুধু আপনার জন্য।</p>
      </div>
      <form className="panel" onSubmit={submit}>
        {err && <div className="err" role="alert">{err}</div>}
        {notice && <div className="ok" role="status">{notice}</div>}
        {mode === 'forgot' && <p className="sub">অ্যাকাউন্টের ইমেইল দিন। পাসওয়ার্ড বদলানোর উপায় পাঠিয়ে দেব।</p>}
        {mode === 'reset' && <p className="sub">নতুন পাসওয়ার্ড দিন।</p>}
        {signup && (
          <>
            <label htmlFor="name">আপনার নাম</label>
            <input id="name" autoComplete="name" maxLength={60} value={f.name} onChange={set('name')} required />
          </>
        )}
        {mode !== 'reset' && (
          <>
            <label htmlFor="email">ইমেইল</label>
            <input id="email" type={signup ? 'email' : 'text'} autoComplete={signup ? 'email' : 'username'} autoCapitalize="none"
              spellCheck="false" readOnly={mode === 'otp'} value={f.email} onChange={set('email')} required />
          </>
        )}
        {mode === 'otp' && (
          <>
            <label htmlFor="otp">ওটিপি কোড</label>
            <input id="otp" className="amtin" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.otp} onChange={set('otp')} required />
          </>
        )}
        {mode !== 'forgot' && (
          <>
            <label htmlFor="pw">{newPw ? 'নতুন পাসওয়ার্ড' : 'পাসওয়ার্ড'}</label>
            <input id="pw" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? undefined : 8} placeholder={mode === 'login' ? '' : 'কমপক্ষে ৮ অক্ষর'}
              value={f.password} onChange={set('password')} required />
          </>
        )}
        {newPw && (
          <>
            <label htmlFor="pw2">আবার লিখুন</label>
            <input id="pw2" type="password" autoComplete="new-password" value={f.again} onChange={set('again')} required />
          </>
        )}
        {mode === 'login' && <button type="button" className="forgot" onClick={() => go('forgot')}>পাসওয়ার্ড ভুলে গেছেন?</button>}
        <button className="go" type="submit" disabled={busy} style={{ '--c': 'var(--pri)' }}>{busy ? 'অপেক্ষা করুন…' : title}</button>
      </form>
      {mode !== 'reset' && (
        <div className="switch">
          {mode === 'login' ? 'নতুন ব্যবহারকারী?' : signup ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : ''}
          <button type="button" onClick={() => go(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'অ্যাকাউন্ট খুলুন' : 'লগইনে ফিরুন'}
          </button>
        </div>
      )}
    </div>
  );
}
