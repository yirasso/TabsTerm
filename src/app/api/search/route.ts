import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchAllProviders } from "@/server/tabs/registry";

const querySchema = z.object({
  q: z.string().trim().min(1, "query is required").max(120),
  /** Optional narrowing; the registry ignores ids that are not enabled. */
  provider: z.string().trim().min(1).max(40).nullable().default(null),
});

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? "",
    provider: params.get("provider"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const data = await searchAllProviders(parsed.data.q, {
    provider: parsed.data.provider,
    signal: request.signal,
  });

  return NextResponse.json(data, {
    headers: {
      // Serve instantly from the edge cache, refresh in the background.
      // `provider` rides in the query string, so it is already part of the key.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
