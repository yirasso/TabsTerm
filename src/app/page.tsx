import { Suspense } from "react";
import { SearchView } from "@/components/search/search-view";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center px-6 py-16">
      <header className="w-full max-w-3xl">
        <h1 className="text-term-accent text-xl">GTabsTerm</h1>
        <p className="mt-1 text-sm text-term-muted">guitar tablature, straight from the prompt</p>
      </header>

      <div className="mt-10 w-full">
        <Suspense fallback={<p className="text-term-muted text-sm">loading…</p>}>
          <SearchView />
        </Suspense>
      </div>
    </main>
  );
}
