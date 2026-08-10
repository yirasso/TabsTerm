import { Suspense } from "react";
import { TerminalApp } from "@/components/terminal/terminal-app";
import { quoteForDay } from "@/data/quotes";
import { activeProviders } from "@/server/tabs/registry";

// Picked on the server so the quote is in the first byte of HTML and cannot
// mismatch on hydration. Regenerating hourly is what makes it change daily.
export const revalidate = 3600;

export default function HomePage() {
  // The enabled set lives in TAB_PROVIDERS, so the prompt learns it from the
  // server rather than guessing or making an extra round trip for it.
  const providers = activeProviders().map((p) => p.id);

  return (
    <Suspense fallback={null}>
      <TerminalApp providers={providers} quote={quoteForDay(new Date())} />
    </Suspense>
  );
}
