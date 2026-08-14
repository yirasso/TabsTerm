import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAllProviders } from "@/server/tabs/registry";

/**
 * The whole library. A route of its own rather than `/api/search?q=`, because
 * "give me everything" and "give me what matches nothing" are different
 * questions and only one of them should ever be answered by an empty input box.
 */
const querySchema = z.object({
  /** Optional narrowing; the registry ignores ids that are not enabled. */
  provider: z.string().trim().min(1).max(40).nullable().default(null),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    provider: request.nextUrl.searchParams.get("provider"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const data = await listAllProviders({
    provider: parsed.data.provider,
    signal: request.signal,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
