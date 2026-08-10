export type TabSection = { label: string; body: string };

const HEADER = /^\[(.+)\]\s*$/;

/**
 * Split a tab's plain-text content into the design's sections. A line like
 * `[Verse]` starts a new section; content before the first header becomes a
 * section labelled "tab". Purely presentational — the data layer stores the
 * content as one string.
 */
export function parseSections(content: string | null): TabSection[] {
  if (!content) return [];

  const sections: TabSection[] = [];
  let label = "";
  let buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").replace(/^\n+/, "").trimEnd();
    if (body) sections.push({ label: label || "tab", body });
    buf = [];
  };

  for (const line of content.split("\n")) {
    const m = HEADER.exec(line);
    if (m) {
      flush();
      label = (m[1] ?? "").toLowerCase();
    } else {
      buf.push(line);
    }
  }
  flush();

  return sections;
}
