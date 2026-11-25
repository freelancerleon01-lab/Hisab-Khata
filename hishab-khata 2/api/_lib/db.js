import pg from 'pg';

// সার্ভারলেস ফাংশনে কানেকশন পুনর্ব্যবহারের জন্য global-এ রাখা হয়
const g = globalThis;
export const pool =
  g.__hkPool ??
  (g.__hkPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000
  }));

export const query = (text, params) => pool.query(text, params);
