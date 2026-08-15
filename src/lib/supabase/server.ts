// Server-side only: this reads the request's cookies, which do not exist in a
// browser. The marker is the same one `src/server/tabs/registry.ts` carries,
// and for the same reason — importing it from a component should fail at build
// time with a message that names the cause.
import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

/** Who is asking. Null when nobody is signed in, or when there are no accounts. */
export type Account = {
  id: string;
  email: string | null;
};

/**
 * A client bound to this request's cookies, or null where this deployment has
 * no accounts.
 *
 * A new one per request, never shared: the client carries the caller's session,
 * and one shared across requests would carry the wrong person's.
 */
export async function serverSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfig) return null;

  const store = await cookies();

  return createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // A Server Component cannot write cookies, and a refresh landing
          // mid-render will try. Swallowing it is safe *because* `src/proxy.ts`
          // refreshes the session on every request, before rendering starts —
          // without that, this catch would be quietly dropping sessions.
        }
      },
    },
  });
}

/**
 * The signed-in account, verified.
 *
 * `getClaims()` and not `getSession()`. A session is read straight out of a
 * cookie, and the browser is what wrote that cookie — trusting it to decide who
 * someone is means trusting the client to name itself. `getClaims()` verifies
 * the token's signature before answering, which is what makes the id it returns
 * safe to use as `owner`.
 */
export async function currentAccount(): Promise<Account | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
}
