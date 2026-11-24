import React, { useMemo, useState } from 'react';
import { B, tk, tkS, bnNum, num, rowDate, Menu } from './lib.jsx';

export default function Ledger({ kind, entries, onGive, onRepay, onDeleteEntry, onDeletePerson, menu, setMenu, day, sel }) {
  const isDhar = kind === 'dhar';
  const label = isDhar ? 'ধার' : 'বাকি';
  const c = isDhar ? 'var(--dhar)' : 'var(--baki)';
  const [side, setSide] = useState('lent');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [item, setItem] = useState('');
  const [open, setOpen] = useState(null);
  const [rp, setRp] = useState({});
  const [busy, setBusy] = useState(false);

  const scoped = useMemo(() => (sel ? entries.filter((e) => e.date === day) : entries), [entries, sel, day]);

  const build = (sd) => {
    const m = {};
    scoped.filter((e) => e.kind === kind && e.side === sd).forEach((e, i) => {
      const p = m[e.name] || (m[e.name] = { name: e.name, out: 0, list: [], last: 0 });
      p.out += e.type === 'give' ? e.amount : -e.amount;
      p.list.push(e);
      p.last = i;
    });
    return Object.values(m).sort((a, b) => (b.out > 0) - (a.out > 0) || b.last - a.last);
  };
  const lent = useMemo(() => build('lent'), [scoped, kind]);
  const borrowed = useMemo(() => build('borrowed'), [scoped, kind]);
  const sum = (ps) => ps.reduce((s, p) => s + p.out, 0);
  const names = [...new Set(entries.filter((e) => e.kind === kind && e.side === side).map((e) => e.name))];

  const submit = async () => {
    const a = num(amount), n = name.trim();
    if (!a || !n || busy) return;
    setBusy(true);
    const ok = await onGive({ kind, side, type: 'give', name: n, amount: a, item: item.trim() });
    setBusy(false);
    if (ok) { setName(''); setAmount(''); setItem(''); }
  };

  const doRepay = async (p, sd) => {
    const k = sd + p.name;
    const a = Math.min(num(rp[k] || ''), p.out);
    if (!a) return;
    const ok = await onRepay({ kind, side: sd, type: 'repay', name: p.name, amount: a });
    if (ok) setRp((r) => ({ ...r, [k]: '' }));
  };

  const lend = side === 'lent';
  const section = (title, people, sd) => (
    <div>
      <h2>{title}</h2>
      <div className="card">
        {people.length === 0 ? (
          <div className="empty">এখনো কোনো {label} নেই।</div>
        ) : (
          people.map((p) => {
            const k = sd + p.name;
            return (
              <div className="person" key={k}>
                <div className="prow">
                  <button className="ph" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}>
                    <span className="n">{p.name}<small>{B(bnNum(p.list.length) + 'টি এন্ট্রি')}</small></span>
                    {p.out > 0 ? <span className="amt" style={{ color: c }}>{tk(p.out)}</span> : <span className="done">পরিশোধিত</span>}
                  </button>
                  <Menu id={'p' + kind + k} menu={menu} setMenu={setMenu} onDelete={() => onDeletePerson(kind, sd, p.name)} />
                </div>
                {open === k && (
                  <div>
                    <div className="hist">
                      {p.list.slice().reverse().map((e) => (
                        <div className="tx" key={e.id}>
                          <div>
                            {e.type === 'give'
                              ? e.item || label + (sd === 'lent' ? ' দিয়েছেন' : ' নিয়েছেন')
                              : sd === 'lent' ? 'পরিশোধ পেয়েছেন' : 'পরিশোধ করেছেন'}
                            <small>{B(rowDate(e.date))}</small>
                          </div>
                          <div className="right">
                            <div className={'amt ' + (e.type === 'give' ? '' : 'in-c')}>{e.type === 'give' ? '' : '−'}{tk(e.amount)}</div>
                            <Menu id={'l' + e.id} menu={menu} setMenu={setMenu} onDelete={() => onDeleteEntry(e.id)} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {p.out > 0 && (
                      <div className="repay">
                        <input className="amtin" style={{ margin: 0 }} inputMode="decimal" placeholder={'বাকি ' + tkS(p.out)}
                          value={rp[k] || ''} onChange={(e) => setRp({ ...rp, [k]: e.target.value })} />
                        <button onClick={() => setRp({ ...rp, [k]: String(p.out) })}>সব</button>
                        <button className="p" onClick={() => doRepay(p, sd)}>পরিশোধ</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="two">
        <div className="hero"><small>{isDhar ? 'টাকা পাবেন' : 'পাবেন'}</small><b style={{ color: c }}>{tk(sum(lent))}</b></div>
        <div className="hero"><small>{isDhar ? 'টাকা পরিশোধ করবেন' : 'পরিশোধ করবেন'}</small><b style={{ color: 'var(--out)' }}>{tk(sum(borrowed))}</b></div>
      </div>
      <h2>নতুন {label}</h2>
      <div className="panel">
        <div className="seg" style={{ '--c': c }}>
          <button className="tw" aria-pressed={lend} onClick={() => setSide('lent')}>{label} দিলাম</button>
          <button className="tw" aria-pressed={!lend} onClick={() => setSide('borrowed')}>{label} নিলাম</button>
        </div>
        <input list={'nm-' + kind} maxLength={60} placeholder={lend ? `কাকে ${label} দিলেন` : `কার কাছ থেকে ${label} নিলেন`} value={name} onChange={(e) => setName(e.target.value)} />
        <datalist id={'nm-' + kind}>{names.map((n) => <option key={n} value={n} />)}</datalist>
        {!isDhar && <input placeholder="কী পণ্য (যেমন: ২ বস্তা চাল)" maxLength={200} value={item} onChange={(e) => setItem(e.target.value)} />}
        <input className="amtin" inputMode="decimal" placeholder={isDhar ? 'কত টাকা' : 'পণ্যের দাম (টাকা)'} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="hint">ধার-বাকির হিসাব আলাদা থাকে। এটি হাতের টাকা, আয় বা খরচে যোগ হয় না।</div>
        <button className="go" disabled={busy} style={{ '--c': c }} onClick={submit}>{label} যোগ করুন</button>
      </div>
      {section('যাদের থেকে ' + label + ' নিয়েছেন', borrowed, 'borrowed')}
      {section('যাদের ' + label + ' দিয়েছেন', lent, 'lent')}
    </div>
  );
}
