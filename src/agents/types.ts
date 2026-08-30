export type AgentResult = unknown;

export type RunAgentOptions = {
  workspace: string;
  prompt: string;
  model?: string;
  /** Override the agent's default image (e.g. a toolchain-extended tag). */
  image?: string;
};

export type AgentRunBindingsOptions = RunAgentOptions & {
  image: string;
};

export type Agent = {
  image: string;
  ensureImage: () => Promise<void>;
  buildImage: () => Promise<void>;
  run: (options: RunAgentOptions) => Promise<AgentResult>;
};

export type AgentOptions = {
  model?: string;
  /** Docker image tag to ensure and run (defaults to the resolved agent's image). */
  image?: string;
};

export type DockerRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type DockerRunOptions = {
  /** Forward docker stdout/stderr to the parent process while still capturing. */
  inheritOutput?: boolean;
  /**
   * Extra environment for the `docker` CLI process itself. Pair with
   * `envPassthrough` to hand a secret to the container without it ever
   * appearing on the host command line.
   */
  env?: Record<string, string>;
};

export type DockerRunner = (args: string[], options?: DockerRunOptions) => Promise<DockerRunResult>;

export type DockerVolumeMount = {
  host: string;
  container: string;
  mode?: "ro" | "rw";
};

export type BuildDockerRunArgsOptions = {
  image: string;
  uid: number;
  gid: number;
  workdir: string;
  command: string[];
  /** `-e NAME=value` — value is visible on the host command line. */
  env?: Record<string, string>;
  /** `-e NAME` — value is read from the docker CLI's own environment, never on argv. */
  envPassthrough?: string[];
  volumes?: DockerVolumeMount[];
};

export type EnsureDockerImageOptions = {
  dockerRunner?: DockerRunner;
};

export type BuildDockerImageOptions = {
  dockerfileRelative: string;
  packageRoot: string;
  dockerRunner?: DockerRunner;
};
