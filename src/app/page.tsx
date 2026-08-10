import { Suspense } from "react";
import { TerminalApp } from "@/components/terminal/terminal-app";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <TerminalApp />
    </Suspense>
  );
}
