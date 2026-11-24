import React from 'react';

const DIGITS = '০১২৩৪৫৬৭৮৯';

// সংখ্যা ও টাকার অংশ Noto Sans Bengali-তে, বাকি বাংলা লেখা Hind Siliguri-তে
export const B = (t) =>
  String(t)
    .split(/([০-৯৳]+(?:,[০-৯]+)*)/)
    .map((p, i) => (i % 2 ? <span className="num" key={i}>{p}</span> : p));

export const tkS = (n) => '৳' + Math.round(n).toLocaleString('bn-BD');
export const tk = (n) => B(tkS(n));
export const bnNum = (n) => Number(n).toLocaleString('bn-BD');

export const dkey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const at = (k) => new Date(k + 'T00:00:00');
export const longDay = (k) => {
  const d = at(k);
  const o = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('bn-BD', o);
};
export const shortDay = (k, today) =>
  k === today ? 'আজকের' : at(k).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' }) + 'ের';
export const rowDate = (k) => at(k).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });

export const num = (s) => {
  const t = String(s).replace(/[০-৯]/g, (d) => DIGITS.indexOf(d)).replace(/[^0-9.]/g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const PATHS = {
  cal: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4',
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  list: 'M4 6h16M4 12h16M4 18h10',
  dhar: 'M7 17L17 7M9 7h8v8',
  baki: 'M6 8h12l-1 12H7zM9 8a3 3 0 016 0',
  dots: 'M12 5.5h.01M12 12h.01M12 18.5h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V4h6v3'
};

export const Ic = ({ n }) => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" style={n === 'dots' ? { strokeWidth: 3.2 } : undefined}>
    <path d={PATHS[n]} />
  </svg>
);

export function Head({ title, tone, sel, setSel, today }) {
  const key = sel || today;
  const openPicker = (e) => {
    try { e.target.showPicker && e.target.showPicker(); } catch { /* ignore */ }
  };
  return (
    <div className="head" style={{ '--t': tone }}>
      <h1>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {sel && (
          <button className="reset" aria-label="আজকে ফিরুন" title="আজকে ফিরুন" onClick={() => setSel(null)}>
            <span className="num">{new Date(today + 'T00:00:00').getDate().toLocaleString('bn-BD')}</span>
          </button>
        )}
        <label className="dt">
          <Ic n="cal" />
          {B(longDay(key))}
          <input
            type="date" value={key} max={today} aria-label="তারিখ বেছে নিন" onClick={openPicker}
            onChange={(e) => { const v = e.target.value; if (v) setSel(v === today ? null : v); }}
          />
        </label>
      </div>
    </div>
  );
}

export function Menu({ id, menu, setMenu, onDelete }) {
  const on = menu === id;
  return (
    <div className="act">
      <div className={'rm' + (on ? ' on' : '')}>
        <button aria-label="মুছে ফেলুন" tabIndex={on ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); setMenu(null); onDelete(); }}>
          <Ic n="trash" />
        </button>
      </div>
      <button className="dots" aria-label="আরও" aria-expanded={on}
        onClick={(e) => { e.stopPropagation(); setMenu(on ? null : id); }}>
        <Ic n="dots" />
      </button>
    </div>
  );
}
