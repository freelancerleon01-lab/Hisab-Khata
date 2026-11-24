import React, { useState } from 'react';
import { B, tk, num, rowDate, Menu } from './lib.jsx';

export function CashForm({ onAdd }) {
  const [type, setType] = useState('in');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const a = num(amount);
    if (!a || busy) return;
    setBusy(true);
    const ok = await onAdd(type, a, note.trim());
    setBusy(false);
    if (ok) { setAmount(''); setNote(''); }
  };

  return (
    <div className="panel">
      <div className="seg">
        <button className="in" aria-pressed={type === 'in'} onClick={() => setType('in')}>আয়</button>
        <button className="out" aria-pressed={type === 'out'} onClick={() => setType('out')}>খরচ</button>
      </div>
      <input className="amtin" inputMode="decimal" placeholder="টাকার পরিমাণ" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input placeholder={type === 'in' ? 'কোথা থেকে (ঐচ্ছিক)' : 'কিসে খরচ (ঐচ্ছিক)'} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="go" disabled={busy} style={{ '--c': type === 'in' ? 'var(--pri)' : 'var(--out)' }} onClick={submit}>
        {type === 'in' ? 'আয় যোগ করুন' : 'খরচ যোগ করুন'}
      </button>
    </div>
  );
}

export function TxList({ items, menu, setMenu, onDelete, empty }) {
  if (!items.length) return <div className="empty">{empty || 'এখনো কোনো লেনদেন নেই। উপরে প্রথম এন্ট্রি দিন।'}</div>;
  return items.map((t) => (
    <div className="tx" key={t.id}>
      <div>
        {t.note || (t.type === 'in' ? 'আয়' : 'খরচ')}
        <small>{B(rowDate(t.date))}</small>
      </div>
      <div className="right">
        <div className={'amt ' + (t.type === 'in' ? 'in-c' : 'out-c')}>{t.type === 'in' ? '+' : '−'}{tk(t.amount)}</div>
        <Menu id={'t' + t.id} menu={menu} setMenu={setMenu} onDelete={() => onDelete(t)} />
      </div>
    </div>
  ));
}
