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
