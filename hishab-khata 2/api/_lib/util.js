export const send = (res, code, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(body);
};
export const bad = (res, msg) => send(res, 400, { error: msg });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 1e12 ? Math.round(n * 100) / 100 : null;
};
export const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
