-- =====================================================================
--  THE LEAD FARMERS — HQ : database schema
--  Run this once in your Supabase project:
--  Dashboard -> SQL Editor -> New query -> paste -> Run
-- =====================================================================

-- Key-value store: books, meetings, and unit settings (JSON blobs).
create table if not exists app_kv (
  k          text primary key,
  v          jsonb,
  updated_at timestamptz default now()
);

-- Message board: one row per transmission.
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  who        text not null,
  body       text not null,
  created_at timestamptz default now()
);

create index if not exists messages_created_idx on messages (created_at desc);

-- ---------------------------------------------------------------------
--  Access policy
--  This is an OPEN club portal: anyone with the site URL can read and
--  write. The browser uses the public "anon" key, so these policies let
--  that key do everything. Fine for a low-stakes book club.
--  (For real per-user control later, switch to Supabase Auth and tighten
--   these policies — see the README security note.)
-- ---------------------------------------------------------------------
alter table app_kv   enable row level security;
alter table messages enable row level security;

drop policy if exists "kv open"       on app_kv;
drop policy if exists "messages open" on messages;

create policy "kv open"       on app_kv   for all using (true) with check (true);
create policy "messages open" on messages for all using (true) with check (true);
