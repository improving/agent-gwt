// Scratch e2e config — not part of the package. Run with:
//   pnpm exec vitest run --config e2e/vitest.e2e.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/**/*.spec.ts"],
    globalSetup: ["./e2e/global-setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
});
