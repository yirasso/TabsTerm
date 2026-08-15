import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

/**
 * Where Supabase sends someone back after Google has vouched for them.
 *
 * It arrives with a one-time `code`; trading it for a session is what writes
 * the cookies that make the person signed in. A Route Handler is the right
 * place for that because it can actually set cookies — a Server Component
 * cannot, which is the whole reason `src/proxy.ts` exists.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  /**
   * Behind a proxy the request's own host is the internal one, and redirecting
   * there sends people somewhere that only exists inside the network.
   *
   * The scheme has to be read, not assumed. Hardcoding `https` here — which is
   * what the Supabase guide does, guarded by a `NODE_ENV` check I left out —
   * sent every local sign-in to `https://localhost:3000` and a bare
   * `ERR_SSL_PROTOCOL_ERROR`, because Next's own dev server sets
   * `x-forwarded-host` too. Reading `x-forwarded-proto` is correct in both
   * places and needs no branch on the environment.
   */
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const origin = forwardedHost
    ? `${forwardedProto ?? url.protocol.replace(":", "")}://${forwardedHost}`
    : url.origin;

  const home = (params = "") => NextResponse.redirect(new URL(`/${params}`, origin));

  // `next` arrives in a query string, so it is whatever the last link said it
  // was. `safeNextPath` is what keeps it pointing at this site.
  const next = safeNextPath(url.searchParams.get("next"));

  // Changing your mind on Google's consent screen is not a failure. It comes
  // back as `access_denied`, and the only correct response is to say nothing.
  const denied = url.searchParams.get("error");
  if (denied) return home(denied === "access_denied" ? "" : "?auth=failed");

  const code = url.searchParams.get("code");
  if (!code) return home("?auth=failed");

  const supabase = await serverSupabase();
  if (!supabase) return home("?auth=failed");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return home("?auth=failed");

  return NextResponse.redirect(new URL(next, origin));
}
