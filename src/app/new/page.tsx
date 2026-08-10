import type { Metadata } from "next";
import { Suspense } from "react";
import { NewTabScreen } from "@/components/editor/new-tab-screen";

export const metadata: Metadata = {
  title: "Write a tab",
  robots: { index: false },
};

export default function NewTabPage() {
  return (
    <Suspense fallback={null}>
      <NewTabScreen />
    </Suspense>
  );
}
