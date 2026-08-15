import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A `?next=` from a query string, reduced to somewhere on this site.
 *
 * Anything that is not a plain path becomes `/`. The one that matters is
 * `//evil.com`: a browser reads a protocol-relative URL as absolute, so
 * redirecting to it leaves the site entirely — which is how a sign-in link
 * turns into somebody else's login page wearing our address in the referrer.
 *
 * It lives here rather than in the route that uses it because a Next route
 * module may only export handlers, and a security check with no test is a
 * security check nobody will notice breaking.
 */
export function safeNextPath(raw: string | null | undefined) {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return "/";
  // `/\evil.com` is read as `//evil.com` by some browsers, backslash and all.
  if (raw.startsWith("/\\")) return "/";
  return raw;
}

/** Combining marks left behind by NFD decomposition. */
const COMBINING_MARKS = /\p{M}/gu;

/** Lowercase, accent-free, hyphenated — safe for URLs and comparisons. */
export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
