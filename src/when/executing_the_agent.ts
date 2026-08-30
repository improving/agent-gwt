import type { AgentContext } from "../types.js";

export async function executing_the_agent(this: AgentContext): Promise<void> {
  if (this.workspace === undefined || this.workspace === "") {
    throw new Error("executing_the_agent requires this.workspace; use a_workspace in given");
  }

  if (this.prompt === undefined || this.prompt === "") {
    throw new Error("executing_the_agent requires this.prompt; use the_prompt(...) in given");
  }

  if (this.agent === undefined) {
    throw new Error(
      "executing_the_agent requires this.agent; use agent({ name, model }) in withAspect",
    );
  }

  const controller = new AbortController();
  await abortWhenTestFinishes(controller);

  const timeoutMs = this.timeoutMs;
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          controller.abort(new Error(`agent run exceeded ${timeoutMs} ms (agent({ timeoutMs }))`));
        }, timeoutMs);

  try {
    this.agentResult = await this.agent.run({
      workspace: this.workspace,
      prompt: this.prompt,
      image: this.image,
      signal: controller.signal,
      ...(this.model !== undefined ? { model: this.model } : {}),
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Under vitest, abort when the test finishes first (typically its own timeout); other runners skip this. */
async function abortWhenTestFinishes(controller: AbortController): Promise<void> {
  try {
    const { onTestFinished } = (await import("vitest")) as {
      onTestFinished?: (fn: () => void) => void;
    };
    onTestFinished?.(() => controller.abort(new Error("the test finished before the agent did")));
  } catch {
    // vitest absent, or not inside a running test
  }
}
