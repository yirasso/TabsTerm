-- `handle_new_user` is `security definer`, and every function in `public` is
-- reachable over PostgREST as `/rest/v1/rpc/<name>`. A trigger function called
-- by hand errors out rather than doing anything useful, so this is a closed
-- door rather than a fixed hole — but a definer function anyone can call is not
-- something to leave lying around on the argument that today it is harmless.
--
-- This one is half the fix, and is kept as its own migration because it is what
-- the database actually recorded. It takes away the implicit `PUBLIC` grant
-- every function is created with; the named roles survive it, and are dealt
-- with in the migration after this one.
revoke execute on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, supabase_auth_admin;
