"use client";

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6">
      <p className="text-term-error">something broke</p>
      <p className="mt-1 text-sm text-term-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 self-start border border-term-border px-3 py-1 text-sm hover:text-term-accent"
      >
        retry
      </button>
    </main>
  );
}
