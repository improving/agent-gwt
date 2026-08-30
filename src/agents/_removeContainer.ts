import { spawnSync } from "node:child_process";

/** Synchronous so it also works from an exit handler and is not cut short by worker teardown. */
export function removeContainer(name: string): void {
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
}
