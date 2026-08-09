import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TabViewer } from "@/components/tab/tab-viewer";
import { getTab } from "@/server/tabs/registry";

type Props = { params: Promise<{ provider: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider, id } = await params;
  const tab = await getTab(provider, decodeURIComponent(id));
  if (!tab) return { title: "Tab not found" };

  return {
    title: `${tab.title} — ${tab.artist}`,
    description: `${tab.type} tablature for ${tab.title} by ${tab.artist}.`,
  };
}

export default async function SongPage({ params }: Props) {
  const { provider, id } = await params;
  const tab = await getTab(provider, decodeURIComponent(id));

  if (!tab) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-16">
      <Link href="/" className="text-sm text-term-muted hover:text-term-accent">
        ← back to search
      </Link>
      <div className="mt-8">
        <TabViewer tab={tab} />
      </div>
    </main>
  );
}
