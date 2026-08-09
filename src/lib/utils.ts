import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
