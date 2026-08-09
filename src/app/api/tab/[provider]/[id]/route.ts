import { type NextRequest, NextResponse } from "next/server";
import { getTab } from "@/server/tabs/registry";

type Params = { params: Promise<{ provider: string; id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { provider, id } = await params;
  const tab = await getTab(provider, decodeURIComponent(id), request.signal);

  if (!tab) {
    return NextResponse.json({ error: "Tab not found" }, { status: 404 });
  }

  return NextResponse.json(tab, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
