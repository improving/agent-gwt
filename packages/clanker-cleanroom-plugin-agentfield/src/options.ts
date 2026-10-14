import type { Remaps } from "clanker-cleanroom";

/** Schema with a Zod-like `parse` (Zod 3/4 or compatible). */
export type ParseableSchema = {
  parse: (value: unknown) => unknown;
};

export type ClankerOptions = {
  /** Stock name (`cursor`, `claude`) or registry tag (`cursor:node`). */
  agent: string;
  /** Host workspace mounted at `/workspace`. */
  workspace: string;
  model?: string;
  /** Override the agent's default Docker image. */
  image?: string;
  remaps?: Remaps;
  signal?: AbortSignal;
  /**
   * When set, appends AgentField-style OUTPUT REQUIREMENTS and validates
   * `.agentfield_output.json` written into {@link workspace}.
   */
  schema?: ParseableSchema | unknown;
};
