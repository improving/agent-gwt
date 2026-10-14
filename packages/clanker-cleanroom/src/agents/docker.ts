import { spawn } from "node:child_process";

import { isAbortError } from "./abort-error.js";
import { forceRemoveContainerTree } from "./cancel.js";
import type { BuildDockerRunArgsOptions, DockerRunResult, DockerRunner } from "./types.js";

export type {
  BuildDockerRunArgsOptions,
  DockerRunOptions,
  DockerRunResult,
  DockerRunner,
  DockerVolumeMount,
} from "./types.js";

export const runDocker: DockerRunner = (args, options = {}) =>
  new Promise((resolve, reject) => {
    const signal = options.signal;
    if (signal?.aborted === true) {
      reject(createAbortError());
      return;
    }

    const input = options.input;
    const child = spawn("docker", args, {
      stdio: [input !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
    });

    if (input !== undefined && child.stdin !== null) {
      child.stdin.on("error", () => {
        // Ignore EPIPE if the container exits before consuming all input.
      });
      child.stdin.end(input);
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    const inheritOutput = options.inheritOutput === true;
    const containerName = options.containerName;

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupAbortListener();
      fn();
    };

    const onAbort = () => {
      void (async () => {
        if (containerName !== undefined && containerName !== "") {
          try {
            await forceRemoveContainerTree(containerName);
          } catch {
            // Best-effort cleanup; still abort the promise below.
          }
        }
        child.kill("SIGKILL");
        settle(() => {
          reject(createAbortError());
        });
      })();
    };

    const cleanupAbortListener = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      if (inheritOutput) {
        process.stdout.write(text);
      }
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      if (inheritOutput) {
        process.stderr.write(text);
      }
    });

    child.on("error", (error: Error) => {
      settle(() => {
        if (signal?.aborted === true || isAbortError(error)) {
          reject(createAbortError());
          return;
        }
        reject(
          new Error(`Failed to start docker: ${error.message}. Is Docker installed and running?`),
        );
      });
    });

    child.on("close", (exitCode: number | null) => {
      settle(() => {
        if (signal?.aborted === true) {
          reject(createAbortError());
          return;
        }
        resolve({ exitCode, stdout, stderr });
      });
    });
  });

function createAbortError(): Error {
  const error = new Error("Docker run aborted");
  error.name = "AbortError";
  return error;
}

export function buildDockerRunArgs(options: BuildDockerRunArgsOptions): string[] {
  const args = ["run", "--rm", "-i", "--user", `${options.uid}:${options.gid}`];

  if (options.name !== undefined && options.name !== "") {
    args.push("--name", options.name);
  }

  if (options.labels !== undefined) {
    for (const [key, value] of Object.entries(options.labels)) {
      args.push("--label", `${key}=${value}`);
    }
  }

  if (options.env !== undefined) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push("-e", `${key}=${value}`);
    }
  }

  if (options.envPassthrough !== undefined) {
    for (const name of options.envPassthrough) {
      args.push("-e", name);
    }
  }

  if (options.volumes !== undefined) {
    for (const volume of options.volumes) {
      const modeSuffix = volume.mode === "ro" ? ":ro" : "";
      args.push("-v", `${volume.host}:${volume.container}${modeSuffix}`);
    }
  }

  args.push("-w", options.workdir, options.image, ...options.command);

  return args;
}

export async function invokeDocker(
  options: BuildDockerRunArgsOptions,
  dockerRunner: DockerRunner = runDocker,
): Promise<DockerRunResult> {
  return dockerRunner(buildDockerRunArgs(options));
}
