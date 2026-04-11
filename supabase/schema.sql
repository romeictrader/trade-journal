-- Trades table
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  contract text not null,
  direction text check (direction in ('Long','Short')) not null,
  entry_price numeric not null,
  exit_price numeric not null,
  contracts integer not null default 1,
  pnl numeric not null,
  setup_tag text,
  emotion_before integer check (emotion_before between 1 and 10),
  emotion_after integer check (emotion_after between 1 and 10),
  notes text,
  created_at timestamptz default now()
);
alter table public.trades enable row level security;
create policy "Users see own trades" on public.trades for all using (auth.uid() = user_id);

-- Journal entries
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  type text check (type in ('daily','weekly','reflection')) default 'daily',
  content jsonb not null default '{}',
  mood integer check (mood between 1 and 5),
  linked_trade_ids uuid[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date, type)
);
alter table public.journal_entries enable row level security;
create policy "Users see own journal" on public.journal_entries for all using (auth.uid() = user_id);

-- Psychology checkins
create table public.psychology_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  confidence integer check (confidence between 1 and 10),
  focus integer check (focus between 1 and 10),
  stress integer check (stress between 1 and 10),
  followed_rules boolean default true,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);
alter table public.psychology_checkins enable row level security;
create policy "Users see own checkins" on public.psychology_checkins for all using (auth.uid() = user_id);

-- Account settings
create table public.account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_balance numeric default 50000,
  daily_loss_limit numeric default 1000,
  max_drawdown numeric default 2500,
  profit_target numeric default 3000,
  account_name text default 'My Account',
  updated_at timestamptz default now()
);
alter table public.account_settings enable row level security;
create policy "Users see own settings" on public.account_settings for all using (auth.uid() = user_id);

-- Storage bucket for journal images (run separately in Supabase dashboard)
-- insert into storage.buckets (id, name, public) values ('journal-images', 'journal-images', false);

-- Accounts table (up to 20 per user)
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  prop_firm text not null,
  account_name text not null,
  account_size numeric default 50000,
  starting_balance numeric default 50000,
  daily_loss_limit numeric default 1000,
  max_drawdown numeric default 2500,
  profit_target numeric default 3000,
  color text default '#c9a84c',
  created_at timestamptz default now()
);
alter table public.accounts enable row level security;
create policy "Users see own accounts" on public.accounts for all using (auth.uid() = user_id);

-- Add account_id to trades
alter table public.trades add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.trades add column if not exists day text;
alter table public.trades add column if not exists outcome text check (outcome in ('Win','Loss','Breakeven'));
alter table public.trades add column if not exists session text;
alter table public.trades add column if not exists news text;
alter table public.trades add column if not exists day_probability text;
alter table public.trades add column if not exists emotions text;
alter table public.trades add column if not exists rules_broken text;
alter table public.trades add column if not exists rr numeric;
alter table public.trades add column if not exists tp_size numeric;
alter table public.trades add column if not exists sl_size numeric;
alter table public.trades add column if not exists execution_time text;
alter table public.trades add column if not exists narrative text;
alter table public.trades add column if not exists context text;
alter table public.trades add column if not exists execution text;
alter table public.trades add column if not exists checklist boolean default false;
alter table public.trades add column if not exists pda text;
alter table public.trades add column if not exists manipulation text;
alter table public.trades add column if not exists explanation text;
alter table public.trades add column if not exists emotions_psych text;

-- User suggestions (autocomplete memory per field)
create table if not exists public.user_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  field_name text not null,
  value text not null,
  use_count integer default 1,
  created_at timestamptz default now(),
  unique(user_id, field_name, value)
);
alter table public.user_suggestions enable row level security;
create policy "Users see own suggestions" on public.user_suggestions for all using (auth.uid() = user_id);

-- Trade images
create table if not exists public.trade_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  trade_id uuid references public.trades(id) on delete cascade,
  storage_path text,
  url text,
  caption text,
  created_at timestamptz default now()
);
alter table public.trade_images enable row level security;
create policy "Users see own trade images" on public.trade_images for all using (auth.uid() = user_id);

alter table public.trades add column if not exists image_urls text[];

-- Journal settings
create table if not exists public.journal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text default 'dark',
  default_currency text default 'USD',
  default_timezone text default 'America/New_York',
  show_pnl_in_header boolean default true,
  date_format text default 'MM/DD/YYYY',
  risk_per_trade numeric default 100,
  updated_at timestamptz default now()
);
alter table public.journal_settings enable row level security;
create policy "Users see own journal_settings" on public.journal_settings for all using (auth.uid() = user_id);
