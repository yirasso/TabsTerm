import { CAPABILITY_DETAIL, CAPABILITY_LABEL, type TabCapability } from "@/lib/tabs/contract";

const TONE: Record<TabCapability, string> = {
  full: "text-term-accent",
  text: "text-term-dim",
  link: "text-term-faint",
};

/**
 * Tells the reader what a result actually gives them before they open it â€”
 * playable tab, silent tab, or a link off-site.
 */
export function CapabilityBadge({
  capability,
  detailed = false,
}: {
  capability: TabCapability;
  detailed?: boolean;
}) {
  const text = detailed ? CAPABILITY_DETAIL[capability] : CAPABILITY_LABEL[capability];
  return (
    <span className={`whitespace-nowrap ${TONE[capability]}`} title={CAPABILITY_DETAIL[capability]}>
      {text}
    </span>
  );
}
