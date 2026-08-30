export type AgentResult = unknown;

export type RunAgentOptions = {
  workspace: string;
  prompt: string;
  model?: string;
  /** Override the agent's default image (e.g. a toolchain-extended tag). */
  image?: string;
  /** Aborting it force-removes the container and rejects the run. */
  signal?: AbortSignal;
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
  /** Cancel a run, and remove its container, after this many milliseconds. */
  timeoutMs?: number;
  /**
   * Named toolchain registered via `buildToolchainImage(variant, ...)`.
   * Mutually exclusive with `image`.
   */
  variant?: string;
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
  /** Written to the process's stdin, then closed. Pair with `interactive` on `docker run`. */
  stdin?: string;
  /** Aborting it kills the process, force-removes `containerName` when set, and rejects. */
  signal?: AbortSignal;
  /** The `--name` given to `docker run`, so an abort or a process exit can `docker rm -f` it. */
  containerName?: string;
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
  /** `--name`, so the container can be force-removed on cancellation. */
  name?: string;
  /** `-i`, keep stdin open so the prompt can be piped in. */
  interactive?: boolean;
  volumes?: DockerVolumeMount[];
};

export type EnsureDockerImageOptions = {
  dockerRunner?: DockerRunner;
};

export type BuildDockerImageOptions = {
  dockerfileRelative: string;
  packageRoot: string;
  dockerRunner?: DockerRunner;
  /** When true, always run `docker build` even if the tag already exists. */
  force?: boolean;
  /** Extra `--build-arg KEY=VALUE` pairs passed to `docker build`. */
  buildArgs?: Record<string, string>;
};
