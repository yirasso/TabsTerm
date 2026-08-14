import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      /*
       * `server-only` is a build-time tripwire: its whole job is to throw the
       * moment a client bundle reaches for it. Vitest is neither bundle, so it
       * hits the throw and the module never loads. Aliasing it away restores
       * the ability to unit-test server modules without weakening the guard —
       * the guard runs where it matters, which is `next build`, and there is a
       * check that it still bites (see the Etapa 1 notes in docs/PLAN.md).
       */
      "server-only": path.resolve(import.meta.dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
