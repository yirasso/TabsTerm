"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * The client for code running in the browser, or null where this deployment
 * has no accounts.
 *
 * Null is a state every caller has to handle rather than an oversight: without
 * Supabase configured there is no session to read and no server to write to,
 * and the app still works — it just keeps tabs in this browser.
 *
 * Sessions are kept in cookies rather than localStorage, which is what lets the
 * server see them at all. `createBrowserClient` is a singleton per set of
 * arguments, so calling this on every render is cheap and always returns the
 * same client.
 */
export function browserSupabase(): SupabaseClient | null {
  if (!supabaseConfig) return null;
  return createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
}
