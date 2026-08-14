import type { ReactNode } from "react";

/**
 * The `$ command` line — the one device every screen in this app shares.
 *
 * It was written out by hand on four screens, in three different tones, always
 * at body size. Pulling it into one object is what lets it be spent: `display`
 * hands a surface its subject, at the size that says so, followed by the same
 * blinking block the prompt uses. Everywhere else it stays quiet chrome, which
 * is what a breadcrumb should be.
 *
 * A surface should use the display form exactly once, and only for the thing it
 * is actually about. Two headlines is no headline.
 */
export function CommandLine({
  children,
  display = false,
}: {
  children: ReactNode;
  display?: boolean;
}) {
  if (!display) {
    return (
      <div className="text-[12px] text-term-faint">
        <span className="text-term-accent">$</span> {children}
      </div>
    );
  }

  return (
    <h1 className="tt-display flex items-baseline gap-[0.4em] text-term-fg">
      <span className="text-term-accent">$</span>
      <span className="min-w-0 truncate">{children}</span>
      <span
        aria-hidden
        className="tt-cursor h-[0.78em] w-[0.5em] flex-none translate-y-[0.06em] bg-term-accent"
      />
    </h1>
  );
}
