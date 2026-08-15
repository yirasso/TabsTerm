-- Until now the handle's shape was only ever produced, never checked: the
-- signup trigger built one that happened to be well formed. Letting people
-- rename themselves makes the shape an input, and a client-side regex is not
-- enforcement — anyone can POST to PostgREST with the publishable key.
--
-- Lowercase, 3 to 32, letters, digits, dot, underscore, dash. The same rule
-- the editor validated back when handles were typed at signup.
alter table public.profiles
  add constraint profiles_handle_shape check (handle ~ '^[a-z0-9._-]{3,32}$');
