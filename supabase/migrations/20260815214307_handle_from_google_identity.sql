-- Google is the only way in, so the handle is derived from what Google
-- actually sends.
--
-- The version this replaces read `user_name` and `preferred_username` first —
-- GitHub's keys. Google sends neither: its metadata is `name`, `full_name`,
-- `email`, `avatar_url` and `sub`. Those two lookups would have been dead code
-- that always fell through, and dead code in a security definer function is
-- worse than dead code elsewhere, because nobody rereads it.
--
-- So: the local part of the email. `tomas.v.girao@gmail.com` becomes
-- `tomas.v.girao`, which is handle-shaped already. `full_name` is deliberately
-- not used — "Tomás Girão" makes a poor handle and a worse unique key.
--
-- A second provider would add its key back at the top of the coalesce.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := lower(split_part(coalesce(new.email, ''), '@', 1));
  -- The same shape the editor has always validated: lowercase, 3+ characters,
  -- letters, digits, dot, underscore, dash.
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

-- `create or replace` resets the privileges to the defaults, which is how the
-- `anon` and `authenticated` grants would quietly come back. Revoked again on
-- purpose, not by habit.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, supabase_auth_admin;
