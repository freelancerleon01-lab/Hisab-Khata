import fs from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL সেট করা নেই (.env ফাইল দেখুন)');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('ডাটাবেস টেবিল তৈরি হয়েছে।');
