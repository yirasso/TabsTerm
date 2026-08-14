import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { TabView } from "@/components/tab/tab-view";
import { getTab } from "@/server/tabs/registry";

type Props = {
  params: Promise<{ provider: string; id: string }>;
  searchParams: Promise<{ q?: string | string[]; view?: string | string[] }>;
};

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider, id } = await params;
  const tab = await getTab(provider, decodeURIComponent(id));
  if (!tab) return { title: "Tab not found" };

  return {
    title: `${tab.title} — ${tab.artist}`,
    description: `${tab.type} tablature for ${tab.title} by ${tab.artist}.`,
  };
}

export default async function SongPage({ params, searchParams }: Props) {
  const [{ provider, id }, sp] = await Promise.all([params, searchParams]);
  const tab = await getTab(provider, decodeURIComponent(id));
  if (!tab) notFound();

  // Escape returns to the exact screen the user came from.
  const qs = new URLSearchParams();
  const q = first(sp.q);
  const view = first(sp.view);
  if (q) qs.set("q", q);
  if (view === "results") qs.set("view", view);
  const backHref = (qs.size ? `/?${qs.toString()}` : "/") as Route;

  return <TabView tab={tab} backHref={backHref} />;
}
