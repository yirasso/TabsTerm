import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { MyTabScreen } from "@/components/tab/my-tab-screen";
import { TabView } from "@/components/tab/tab-view";
import { MINE_PROVIDER } from "@/lib/tabs/contract";
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

  // A tab of your own is in the reader's browser, so the server cannot name it
  // — and would not put it in an index if it could.
  if (provider === MINE_PROVIDER) return { title: "Tab", robots: { index: false } };

  const tab = await getTab(provider, decodeURIComponent(id));
  if (!tab) return { title: "Tab not found" };

  return {
    title: `${tab.title} — ${tab.artist}`,
    description: `${tab.type} tablature for ${tab.title} by ${tab.artist}.`,
  };
}

export default async function SongPage({ params, searchParams }: Props) {
  const [{ provider, id }, sp] = await Promise.all([params, searchParams]);

  // Escape returns to the exact screen the user came from.
  const qs = new URLSearchParams();
  const q = first(sp.q);
  const view = first(sp.view);
  if (q) qs.set("q", q);
  if (view === "results") qs.set("view", view);
  const backHref = (qs.size ? `/?${qs.toString()}` : "/") as Route;

  // One screen opens a tab, whoever holds it. `mine` is the only id the server
  // cannot resolve, so it hands the read to the client instead of 404ing on a
  // tab that exists perfectly well in the browser asking for it.
  if (provider === MINE_PROVIDER) {
    return <MyTabScreen id={decodeURIComponent(id)} backHref={backHref} />;
  }

  const tab = await getTab(provider, decodeURIComponent(id));
  if (!tab) notFound();

  return <TabView tab={tab} backHref={backHref} />;
}
