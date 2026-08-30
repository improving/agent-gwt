import { spawn } from "node:child_process";

import type { DockerRunOptions, DockerRunResult } from "./types.js";

type RunProcessOptions = Omit<DockerRunOptions, "containerName"> & {
  /** Called once on abort, before the process is killed. */
  onAbort?: () => void;
};

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<DockerRunResult> {
  return new Promise((resolve, reject) => {
    const { signal } = options;

    if (signal?.aborted === true) {
      reject(cancelledError(command, signal.reason));
      return;
    }

    const child = spawn(command, args, {
      stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";
    let cancelled: Error | undefined;
    const inheritOutput = options.inheritOutput === true;

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      if (inheritOutput) {
        process.stdout.write(text);
      }
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      if (inheritOutput) {
        process.stderr.write(text);
      }
    });

    if (options.stdin !== undefined && child.stdin !== null) {
      // Ignore EPIPE: the child may exit before draining stdin.
      child.stdin.on("error", () => undefined);
      child.stdin.end(options.stdin);
    }

    const onAbort = () => {
      cancelled = cancelledError(command, signal?.reason);
      try {
        options.onAbort?.();
      } finally {
        child.kill("SIGKILL");
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error: Error) => {
      signal?.removeEventListener("abort", onAbort);
      const hint = command === "docker" ? " Is Docker installed and running?" : "";
      reject(new Error(`Failed to start ${command}: ${error.message}.${hint}`));
    });

    child.on("close", (exitCode: number | null) => {
      signal?.removeEventListener("abort", onAbort);
      if (cancelled !== undefined) {
        reject(cancelled);
        return;
      }
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function cancelledError(command: string, reason: unknown): Error {
  const detail = reason instanceof Error ? reason.message : String(reason);
  return new Error(`${command} run cancelled: ${detail}`);
}
