import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[820px] flex-col justify-center px-[22px]">
      <div className="text-term-dim">
        <span className="text-term-accent">$</span> open …
      </div>
      <pre className="mt-2 whitespace-pre-wrap text-[13px] text-term-dim">
        err 404: no such tab in the index
      </pre>
      <Link
        href="/"
        className="mt-[22px] inline-block self-start border border-term-line px-3 py-[7px] text-[12px] text-term-fg hover:border-term-accent hover:text-term-accent"
      >
        [esc] back to prompt
      </Link>
    </main>
  );
}
