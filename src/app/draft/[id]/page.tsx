import type { Metadata } from "next";
import { DraftScreen } from "@/components/editor/draft-screen";

export const metadata: Metadata = {
  title: "Draft",
  robots: { index: false },
};

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DraftScreen id={id} />;
}
