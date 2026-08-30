import { randomBytes } from "node:crypto";

/** A unique `--name` per run, so the container can be found and force-removed. */
export function containerName(agent: string): string {
  return `agent-gwt-${agent}-${randomBytes(4).toString("hex")}`;
}
