import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { randomTab } from "@/server/tabs/registry";

// A different tab every time, so this must never be cached or prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Random tab",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ src?: string | string[] }> };

export default async function RandomPage({ searchParams }: Props) {
  const { src } = await searchParams;
  const provider = Array.isArray(src) ? src[0] : src;
  const tab = await randomTab({ provider: provider ?? null });

  if (tab) {
    redirect(`/song/${tab.provider}/${encodeURIComponent(tab.id)}` as Route);
  }

  // Not an error — the enabled sources simply cannot enumerate a catalog.
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[820px] flex-col justify-center px-[22px]">
      <div className="text-term-dim">
        <span className="text-term-accent">$</span> random
        {provider ? ` --src ${provider}` : ""}
      </div>
      <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.9] text-term-dim">
        {`nothing to draw from${provider ? ` in "${provider}"` : ""}.

  · random picks from sources that host their own tablature
  · songsterr can only be searched, not browsed`}
      </pre>
      <Link
        href="/"
        className="mt-[22px] inline-block self-start border border-term-line px-3 py-[7px] text-[12px] text-term-fg hover:border-term-accent hover:text-term-accent"
      >
        [esc] back to prompt
      </Link>
    </main>
  );
}
