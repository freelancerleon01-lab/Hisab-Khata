import React, { useCallback, useEffect, useRef, useState } from 'react';
import { B, Ic, bnNum, dkey } from './lib.jsx';
import { startRing, stopRing, unlockAudio } from './audio.js';

const STATE_KEY = 'hk_alarm';
const GRACE = 10 * 60 * 1000; // সময় পেরোনোর পর ১০ মিনিট পর্যন্ত অ্যালার্ম বাজবে
const MAX_RING = 5 * 60 * 1000; // সাড়া না দিলে ৫ মিনিট পর নিজে থেকে বন্ধ

const readState = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch { return {}; } };
const writeState = (s) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

const atTime = (hhmm, base) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

// শুক্রবারে জুমা থাকলে যোহরের জায়গায় জুমা, অন্য দিনে জুমা বাদ
export function dayPrayers(times, now) {
  const fri = now.getDay() === 5;
  const jumua = times.find((t) => t.key === 'jumua');
  const useJumua = fri && jumua && jumua.enabled;
  return times.filter((t) => t.enabled && (t.key === 'jumua' ? fri : !(t.key === 'dhuhr' && useJumua)));
}

export const fmtTime = (hhmm) =>
  B(new Date(2000, 0, 1, ...hhmm.split(':').map(Number)).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true }));

export function useAlarm({ times, snooze, alarmsOff }) {
  const [ring, setRing] = useState(null);
  const ringRef = useRef(null);

  const begin = useCallback((r) => { ringRef.current = r; setRing(r); startRing(); }, []);
  const end = useCallback((patch) => {
    const r = ringRef.current;
    if (!r) return;
    stopRing();
    if (!r.test) {
      const st = readState();
      st.done = { ...(st.done || {}) };
      st.snoozed = { ...(st.snoozed || {}) };
      if (patch.snoozeUntil) st.snoozed[r.key] = patch.snoozeUntil;
      else { st.done[r.key] = true; delete st.snoozed[r.key]; }
      writeState(st);
    }
    ringRef.current = null;
    setRing(null);
  }, []);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const today = dkey(now.getTime());
      let st = readState();
      if (st.date !== today) { st = { date: today, done: {}, snoozed: {} }; writeState(st); }
      const cur = ringRef.current;
      if (cur) {
        if (!cur.test && Date.now() - cur.startedAt > MAX_RING) end({});
        return;
      }
      for (const t of dayPrayers(times, now)) {
        if (alarmsOff.includes(t.key) || (st.done || {})[t.key]) continue;
        const sn = (st.snoozed || {})[t.key];
        const go = () => begin({ key: t.key, label: t.label, time: t.time, startedAt: Date.now() });
        if (sn) { if (Date.now() >= sn) { go(); return; } continue; }
        const diff = Date.now() - atTime(t.time, now).getTime();
        if (diff >= 0 && diff < GRACE) { go(); return; }
      }
    };
    check();
    const i = setInterval(check, 1000);
    return () => clearInterval(i);
  }, [times, alarmsOff, begin, end]);

  return {
    ring,
    stop: () => end({}),
    snooze: () => end({ snoozeUntil: Date.now() + snooze * 60000 }),
    test: () => begin({ key: 'test', label: 'টেস্ট', time: null, test: true, startedAt: Date.now() })
  };
}

export function AlarmScreen({ ring, snooze, onStop, onSnooze }) {
  return (
    <div className="alarm" role="alertdialog" aria-modal="true" aria-label="নামাজের অ্যালার্ম">
      <div className="ring"><Ic n="bell" /></div>
      <h2>{ring.test ? 'টেস্ট অ্যালার্ম' : ring.label + 'ের সময় হয়েছে'}</h2>
      {ring.time && <p>{fmtTime(ring.time)}</p>}
      <div className="btns">
        <button className="stop" autoFocus onClick={onStop}>বন্ধ করুন</button>
        {!ring.test && <button className="snz" onClick={onSnooze}>{B(bnNum(snooze) + ' মিনিট স্নুজ')}</button>}
      </div>
    </div>
  );
}

export function PrayerTab({ data, alarmsOff, onToggle, onTest }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(i); }, []);
  if (!data) return <div className="boot">লোড হচ্ছে…</div>;

  const list = dayPrayers(data.times, now).slice().sort((a, b) => a.time.localeCompare(b.time));
  if (!list.length) return <div className="card"><div className="empty">এখনো কোনো সময়সূচি দেওয়া হয়নি।</div></div>;

  let next = list.find((t) => atTime(t.time, now) > now);
  let tomorrow = false;
  if (!next) { next = list[0]; tomorrow = true; }
  const when = atTime(next.time, now);
  if (tomorrow) when.setDate(when.getDate() + 1);
  const mins = Math.max(0, Math.round((when - now) / 60000));
  const left = (mins >= 60 ? bnNum(Math.floor(mins / 60)) + ' ঘণ্টা ' : '') + bnNum(mins % 60) + ' মিনিট বাকি';

  return (
    <div>
      <div className="next">
        <small>{tomorrow ? 'আগামীকাল' : 'পরবর্তী নামাজ'}</small>
        <b>{next.label} · {fmtTime(next.time)}</b>
        <small>{B(left)}</small>
      </div>
      <h2>আজকের সময়সূচি<button onClick={onTest}>অ্যালার্ম পরীক্ষা</button></h2>
      <div className="card">
        {list.map((t) => (
          <div className={'pr' + (t.key === next.key ? ' now' : '')} key={t.key}>
            <div><span className="t n1">{t.label}</span><small>{fmtTime(t.time)}</small></div>
            <label className="sw" aria-label={t.label + ' অ্যালার্ম'}>
              <input type="checkbox" checked={!alarmsOff.includes(t.key)} onChange={(e) => { unlockAudio(); onToggle(t.key, e.target.checked); }} />
              <i />
            </label>
          </div>
        ))}
      </div>
      <div className="hint" style={{ margin: '10px 2px' }}>অ্যালার্ম বাজার সময় অ্যাপটি খোলা থাকতে হবে।</div>
    </div>
  );
}
