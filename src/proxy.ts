/**
 * Refreshes the session before anything renders.
 *
 * A Supabase access token is short-lived, and the refresh has to be written
 * back as a cookie. Server Components cannot set cookies, so if this file is
 * missing or wrong the failure is not a clean error — it is random logouts and
 * sessions that end early, which look like anything but a missing proxy.
 *
 * It is `proxy.ts`, not `middleware.ts`: Next 16 deprecated that convention and
 * warns on every build. Every Supabase guide still says middleware, and having
 * both files is a hard error, so this is the one that stays.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  // No accounts configured: nothing to refresh, and the app runs on
  // localStorage exactly as it did before there was a server.
  if (!supabaseConfig) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        // The refreshed cookies have to reach both sides: the request, so this
        // render sees the new token, and the response, so the browser keeps it.
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        // A response that sets auth cookies must never be cached — a CDN that
        // stores one would hand one person's session to the next visitor.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // This call is the refresh. It has to happen here, before the response is
  // built, because a token that arrives after the response is committed has
  // nowhere to be written and is lost.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything a person navigates to, and nothing a machine fetches on the
     * side: static output, images, the favicon, and `public/models`, which is
     * the several-megabyte Basic Pitch model and has no session to refresh.
     */
    "/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|bin|json)$).*)",
  ],
};
