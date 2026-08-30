import { removeContainer } from "./_removeContainer.js";

const running = new Set<string>();
let hooksInstalled = false;

/** Track a running container so process exit or a termination signal can force-remove it. */
export function trackContainer(name: string): void {
  running.add(name);

  if (!hooksInstalled) {
    hooksInstalled = true;
    process.once("exit", removeAll);
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.once(signal, () => {
        removeAll();
        // re-raise so the process still terminates
        process.kill(process.pid, signal);
      });
    }
  }
}

export function untrackContainer(name: string): void {
  running.delete(name);
}

function removeAll(): void {
  for (const container of running) {
    removeContainer(container);
  }
  running.clear();
}
