/**
 * Whether this deployment has accounts, and what to connect to.
 *
 * Two rules meet in this file.
 *
 * **Accounts are optional.** With neither variable set the app runs exactly as
 * it did before there was a server to talk to: tabs live in localStorage and
 * the account button says so. That is not a courtesy to newcomers — `npm run
 * test:e2e` runs offline and a clone with no `.env.local` has to build, and
 * `src/lib/env.ts` throws at startup when its schema fails. An absent Supabase
 * is a configuration, not an error.
 *
 * **Half-configured is an error, though.** One variable without the other is
 * somebody's mistake, and falling back to local storage there would run a
 * deployment its operator believes has accounts, silently, with everyone's tabs
 * going into a browser instead of a database. It throws instead.
 *
 * It lives here rather than in `src/lib/env.ts` for the reason
 * `src/lib/tabs/contract.ts` lives outside `server/`: the browser genuinely
 * needs these two values, and `env.ts` holds server configuration that has no
 * business in a client bundle. Both are public by design — the anon key is
 * meant to be shipped, and row-level security is what protects the data.
 */

import { z } from "zod";

const schema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
});

// Written out longhand because Next substitutes `process.env.NEXT_PUBLIC_*`
// textually at build time: destructuring `process.env` here would leave both
// undefined in the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function read() {
  if (!url && !anonKey) return null;

  const parsed = schema.safeParse({ url, anonKey });
  if (!parsed.success) {
    throw new Error(
      `Supabase is half-configured. Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or neither:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

export const supabaseConfig = read();

/** Whether this deployment can hold an account at all. */
export const hasAccounts = supabaseConfig !== null;
