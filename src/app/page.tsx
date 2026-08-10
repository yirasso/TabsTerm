import { Suspense } from "react";
import { TerminalApp } from "@/components/terminal/terminal-app";
import { activeProviders } from "@/server/tabs/registry";

export default function HomePage() {
  // The enabled set lives in TAB_PROVIDERS, so the prompt learns it from the
  // server rather than guessing or making an extra round trip for it.
  const providers = activeProviders().map((p) => p.id);

  return (
    <Suspense fallback={null}>
      <TerminalApp providers={providers} />
    </Suspense>
  );
}
