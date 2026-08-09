import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6">
      <p className="text-term-error">404 — no such tab</p>
      <Link href="/" className="mt-2 text-sm text-term-muted hover:text-term-accent">
        ← back to search
      </Link>
    </main>
  );
}
