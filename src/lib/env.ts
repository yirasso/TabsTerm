import { z } from "zod";

const csv = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

const serverSchema = z.object({
  TAB_PROVIDERS: csv("local,songsterr"),
  TAB_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = serverSchema.safeParse({
  TAB_PROVIDERS: process.env.TAB_PROVIDERS,
  TAB_FETCH_TIMEOUT_MS: process.env.TAB_FETCH_TIMEOUT_MS,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
