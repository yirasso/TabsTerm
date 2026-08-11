import type { Metadata } from "next";
import { TranscribeScreen } from "@/components/transcribe/transcribe-screen";

export const metadata: Metadata = {
  title: "Transcribe audio",
  robots: { index: false },
};

export default function ListenPage() {
  return <TranscribeScreen />;
}
