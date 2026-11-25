async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `সমস্যা হয়েছে, আবার চেষ্টা করুন। (কোড ${res.status})`), { status: res.status });
  }
  return data;
}
const post = (url, body) => request('POST', url, body || {});

export const api = {
  me: () => request('GET', '/api/me'),
  signup: (b) => post('/api/signup', b),
  login: (b) => post('/api/login', b),
  logout: () => post('/api/logout'),
  forgot: (b) => post('/api/forgot', b),
  reset: (b) => post('/api/reset', b),
  data: () => request('GET', '/api/data'),
  addTx: (b) => post('/api/transactions', b),
  delTx: (id) => post('/api/transactions/delete', { id }),
  addLed: (b) => post('/api/ledger', b),
  delLed: (id) => post('/api/ledger/delete', { id }),
  delPerson: (kind, side, name) => post('/api/ledger/delete-person', { kind, side, name }),
  prayers: () => request('GET', '/api/prayers'),
  profile: (b) => post('/api/profile', b),
  password: (b) => post('/api/password', b),
  prefs: (b) => post('/api/prefs', b),
  admin: {
    otp: (b) => post('/api/admin/otp', b),
    reset: (b) => post('/api/admin/reset', b),
    logout: () => post('/api/admin/logout'),
    stats: () => request('GET', '/api/admin/stats'),
    prayers: () => request('GET', '/api/admin/prayers'),
    savePrayers: (b) => post('/api/admin/prayers', b),
    password: (b) => post('/api/admin/password', b),
    email: (b) => post('/api/admin/email', b)
  }
};
