-- Accounts, and the tabs that belong to them.
--
-- The whole product rule is in the two policies at the bottom: only the owner
-- reads, only the owner writes. Nothing a user makes is ever visible to another
-- user, and that is what lets someone transcribe a recording they own — it is
-- personal use, not distribution. Writing it here rather than in the app is the
-- point: a policy holds even when a query forgets to filter.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Lowercase, 3+ characters, the same shape the editor has always validated.
  handle text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tabs
-- ---------------------------------------------------------------------------

create table public.tabs (
  owner uuid not null references auth.users (id) on delete cascade,

  -- Text, not a uuid, and half of the primary key rather than all of it.
  --
  -- Ids are visible in URLs (`/song/mine/2a3fk1`), so they stay short. They
  -- only have to be unique within one person's library, which is exactly what
  -- `(owner, id)` says — and it means a tab written in a browser keeps the id
  -- it already has when it is adopted into an account. That is what makes
  -- adopting idempotent: the second sign-in upserts onto the same row instead
  -- of giving someone their library twice.
  id text not null,

  title text not null,
  artist text not null default '',
  -- Guitar tablature only, deliberately. A widened contract should have to
  -- change this line on purpose.
  type text not null default 'tab' check (type = 'tab'),
  tuning text[],
  capo smallint check (capo between 0 and 12),
  content text not null default '',

  -- What the editor's action reads: `publish` the first time, `update` after.
  -- An unpublished tab has never left the editor and stays out of search.
  published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (owner, id)
);

-- The library, newest first, is the only way these are ever listed.
create index tabs_owner_updated_at on public.tabs (owner, updated_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tabs enable row level security;

-- One policy per table, covering both directions, because the rule really is
-- the same one both ways: only the owner reads, only the owner writes. Two
-- policies would be two places to get it wrong.
--
-- `(select auth.uid())` rather than a bare `auth.uid()`: the subquery is
-- evaluated once for the statement instead of once per row.

create policy "a profile belongs to one person"
  on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "a tab belongs to one person"
  on public.tabs
  for all
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

-- ---------------------------------------------------------------------------
-- A profile for every new account
-- ---------------------------------------------------------------------------

-- With OAuth nobody types a handle, so one is derived from what the provider
-- sent: `user_name` on GitHub, `preferred_username` elsewhere, the local part
-- of the email as a last resort. Handles are unique, so collisions are settled
-- here — quietly, with a number — rather than by refusing the sign-in of the
-- second person called tomas.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Empty search path, with everything below qualified: a security definer
-- function that resolves names through the caller's path can be pointed at
-- someone else's table.
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := lower(coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  ));
  base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');
  if length(base) < 3 then
    base := 'user';
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;

  insert into public.profiles (id, handle) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

-- Stamped by the database rather than by whoever is writing: the library is
-- ordered by this column, and a client clock that is wrong reorders someone's
-- tabs.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tabs_touch_updated_at
  before update on public.tabs
  for each row execute function public.touch_updated_at();
