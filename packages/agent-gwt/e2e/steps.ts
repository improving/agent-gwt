import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";

import type { AgentContext } from "../src/index.js";

// Shared "then" steps: the same assertions run against whichever agent wrote the file.

export async function readme_exists(this: AgentContext) {
  await access(join(this.workspace, "README.md"));
}

export async function readme_contains_HELLO_WORLD(this: AgentContext) {
  const contents = await readFile(join(this.workspace, "README.md"), "utf-8");

  expect(contents.toLowerCase()).toContain("hello world");
}
