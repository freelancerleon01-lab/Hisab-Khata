async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'সমস্যা হয়েছে, আবার চেষ্টা করুন।'), { status: res.status });
  }
  return data;
}

export const api = {
  me: () => request('GET', '/api/me'),
  signup: (b) => request('POST', '/api/signup', b),
  login: (b) => request('POST', '/api/login', b),
  logout: () => request('POST', '/api/logout', {}),
  data: () => request('GET', '/api/data'),
  addTx: (b) => request('POST', '/api/transactions', b),
  delTx: (id) => request('DELETE', `/api/transactions/${id}`),
  addLed: (b) => request('POST', '/api/ledger', b),
  delLed: (id) => request('DELETE', `/api/ledger/${id}`),
  delPerson: (kind, side, name) =>
    request('DELETE', `/api/ledger/person?kind=${kind}&side=${side}&name=${encodeURIComponent(name)}`)
};
