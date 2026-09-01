// End-to-end suite: builds the real agent images and runs each agent in Docker.
// Each agent's tests run only when its credential is present on the host and skip
// cleanly otherwise (Cursor: `agent login`; Claude: CLAUDE_CODE_OAUTH_TOKEN or
// ANTHROPIC_API_KEY). On Apple Silicon export DOCKER_DEFAULT_PLATFORM=linux/amd64.
//
//   pnpm run test:e2e
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/**/*.spec.ts"],
    globalSetup: ["./e2e/global-setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
});
