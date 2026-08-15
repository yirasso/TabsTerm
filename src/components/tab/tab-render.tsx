"use client";

import { staveAtColumn, type TabBlock } from "@/lib/tab/parse-notes";

/**
 * Renders the parsed blocks, with a cursor sitting on the column being played.
 *
 * The cursor is positioned in `ch` units. In a monospace font one `ch` is
 * exactly one character wide, so the bar lands on the right column without
 * measuring anything — which is also why `.tab-content` must keep its
 * fixed-width font and `white-space: pre`.
 */
export function TabRender({
  blocks,
  column,
  activeRef,
}: {
  blocks: TabBlock[];
  /** Global column under the cursor, or -1 when stopped. */
  column: number;
  /** Attached to the stave currently playing, so autoscroll can find it. */
  activeRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // Which stave holds the cursor is decided once, by the parse, so the bar and
  // the page that follows it can never point at different staves.
  const activeId = staveAtColumn(blocks, column)?.id ?? null;

  return (
    <div className="flex flex-col gap-[34px]">
      {blocks.map((block) => {
        if (block.kind === "text") {
          return (
            <pre key={block.id} className="tab-content text-[13px] text-term-dim leading-[1.8]">
              {block.text}
            </pre>
          );
        }

        const local = column - block.columnOffset;
        const active = block.id === activeId;

        return (
          <div
            key={block.id}
            ref={active ? activeRef : undefined}
            className="relative border-l-2 pl-4"
            style={{ borderColor: active ? "var(--tt-accent)" : "var(--tt-line)" }}
          >
            {active && (
              <span
                aria-hidden
                data-testid="tab-cursor"
                className="pointer-events-none absolute top-0 bottom-0 w-[1ch] bg-term-accent opacity-25"
                style={{ left: `calc(1rem + ${local}ch)` }}
              />
            )}
            {/* The tablature is the artifact, not a code sample. At 13px it
                read like a footnote to its own page.

                No letter-spacing: the cursor above is placed in `ch`, and any
                tracking makes a character advance more than one `ch`, so the
                bar drifts a little further right with every column it crosses —
                three characters out by the end of a stave. */}
            <pre className="tab-content relative text-[15px] leading-[1.85]">
              {block.lines.join("\n")}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
