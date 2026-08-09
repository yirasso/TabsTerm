import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchAllProviders } from "@/server/tabs/registry";

const querySchema = z.object({
  q: z.string().trim().min(1, "query is required").max(120),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const data = await searchAllProviders(parsed.data.q, request.signal);

  return NextResponse.json(data, {
    headers: {
      // Serve instantly from the edge cache, refresh in the background.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
