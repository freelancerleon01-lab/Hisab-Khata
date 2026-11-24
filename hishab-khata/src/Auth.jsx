import React, { useState } from 'react';
import { api } from './api.js';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const { user } = signup ? await api.signup(f) : await api.login({ email: f.email, password: f.password });
      onAuth(user);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="head" style={{ '--t': 'var(--pri)' }}>
        <h1>হিসাব খাতা</h1>
        <p>আপনার আয়, খরচ, ধার ও বাকির হিসাব, শুধু আপনার জন্য।</p>
      </div>
      <form className="panel" onSubmit={submit}>
        {err && <div className="err" role="alert">{err}</div>}
        {signup && (
          <>
            <label htmlFor="name">আপনার নাম</label>
            <input id="name" autoComplete="name" maxLength={60} value={f.name} onChange={set('name')} required />
          </>
        )}
        <label htmlFor="email">ইমেইল</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={set('email')} required />
        <label htmlFor="pw">পাসওয়ার্ড</label>
        <input id="pw" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined}
          placeholder={signup ? 'কমপক্ষে ৮ অক্ষর' : ''} value={f.password} onChange={set('password')} required />
        <button className="go" type="submit" disabled={busy} style={{ '--c': 'var(--pri)' }}>
          {busy ? 'অপেক্ষা করুন…' : signup ? 'অ্যাকাউন্ট খুলুন' : 'লগইন করুন'}
        </button>
      </form>
      <div className="switch">
        {signup ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : 'নতুন ব্যবহারকারী?'}
        <button type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setErr(''); }}>
          {signup ? 'লগইন করুন' : 'অ্যাকাউন্ট খুলুন'}
        </button>
      </div>
    </div>
  );
}
