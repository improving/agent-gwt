export type AgentResult = unknown;

export type RunAgentOptions = {
  workspace: string;
  prompt: string;
  model?: string;
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
};

export type DockerRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type DockerRunner = (args: string[]) => Promise<DockerRunResult>;

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
  env?: Record<string, string>;
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
