-- হিসাব খাতা: PostgreSQL স্কিমা (একাধিকবার চালালেও সমস্যা নেই)

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists users_email_key on users (lower(email));

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists login_attempts (
  email text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_idx on login_attempts (email, at);

-- আয় ও খরচ
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  amount numeric(14, 2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  occurred_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_day_idx on transactions (user_id, occurred_on desc, created_at desc);

-- ধার ও বাকি (kind), দিয়েছি/নিয়েছি (side), মূল টাকা/পরিশোধ (type)
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('dhar', 'baki')),
  side text not null check (side in ('lent', 'borrowed')),
  type text not null check (type in ('give', 'repay')),
  person_name text not null check (char_length(person_name) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),
  item text not null default '' check (char_length(item) <= 200),
  occurred_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_person_idx on ledger_entries (user_id, kind, side, person_name);
create index if not exists ledger_day_idx on ledger_entries (user_id, occurred_on);

-- পাসওয়ার্ড রিসেট লিংক (শুধু টোকেনের হ্যাশ জমা থাকে)
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on password_resets (user_id, created_at);

-- ব্যবহারকারীর পছন্দ (কালার থিম, অ্যালার্ম বন্ধ রাখা নামাজ)
alter table users add column if not exists prefs jsonb not null default '{}'::jsonb;

-- অ্যাডমিন
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username !~ '@' and char_length(username) between 3 and 40),
  email text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists admins_username_key on admins (lower(username));

create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- অ্যাডমিনের পাসওয়ার্ড রিসেটের ওটিপি (শুধু হ্যাশ জমা থাকে)
create table if not exists admin_otps (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_otps_idx on admin_otps (admin_id, created_at);

-- নামাজের সময়সূচি (অ্যাডমিন ঠিক করেন, সব ব্যবহারকারী দেখেন)
create table if not exists prayer_times (
  code text primary key,
  label text not null,
  at_time text not null check (at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enabled boolean not null default true,
  sort int not null
);
insert into prayer_times (code, label, at_time, enabled, sort) values
  ('fajr', 'ফজর', '05:00', true, 1),
  ('dhuhr', 'যোহর', '13:00', true, 2),
  ('jumua', 'জুমা', '13:15', true, 3),
  ('asr', 'আসর', '16:30', true, 4),
  ('maghrib', 'মাগরিব', '18:00', true, 5),
  ('isha', 'এশা', '19:45', true, 6)
on conflict (code) do nothing;

create table if not exists app_settings (key text primary key, value text not null);
insert into app_settings (key, value) values ('snooze_minutes', '5') on conflict (key) do nothing;
