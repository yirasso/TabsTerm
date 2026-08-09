import type { Tab } from "@/server/tabs/types";

export function TabViewer({ tab }: { tab: Tab }) {
  return (
    <article className="w-full">
      <header className="border-term-border border-b pb-4">
        <h1 className="text-lg text-term-accent">{tab.title}</h1>
        <p className="text-sm text-term-muted">{tab.artist}</p>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-term-muted">
          {tab.tuning && (
            <div className="flex gap-1">
              <dt>tuning:</dt>
              <dd className="text-term-fg">{tab.tuning.join(" ")}</dd>
            </div>
          )}
          {tab.capo !== null && (
            <div className="flex gap-1">
              <dt>capo:</dt>
              <dd className="text-term-fg">{tab.capo === 0 ? "none" : `fret ${tab.capo}`}</dd>
            </div>
          )}
          {tab.difficulty && (
            <div className="flex gap-1">
              <dt>difficulty:</dt>
              <dd className="text-term-fg">{tab.difficulty}</dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt>source:</dt>
            <dd className="text-term-fg">{tab.provider}</dd>
          </div>
        </dl>
      </header>

      {tab.content ? (
        <pre className="tab-content mt-6 text-sm leading-relaxed">{tab.content}</pre>
      ) : (
        <p className="mt-6 text-sm text-term-muted">
          This tab is only playable on the source site.
          {tab.sourceUrl && (
            <>
              {" "}
              <a
                href={tab.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-term-accent underline"
              >
                Open on {tab.provider} ↗
              </a>
            </>
          )}
        </p>
      )}
    </article>
  );
}
