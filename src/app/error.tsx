"use client";

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[820px] flex-col justify-center px-[22px]">
      <div className="text-term-dim">
        <span className="text-term-accent">$</span> …
      </div>
      <pre className="mt-2 whitespace-pre-wrap text-[13px] text-term-dim">
        err: something broke — {error.message}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="mt-[22px] self-start border border-term-line px-3 py-[7px] text-[12px] hover:border-term-accent hover:text-term-accent"
      >
        [r] retry
      </button>
    </main>
  );
}
