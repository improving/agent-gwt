import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "./base/constants.js";
import { buildDockerRunArgs, runDocker } from "./docker.js";
import { agentRunError } from "./run-error.js";
import type {
  AgentBinding,
  AgentRunBindingsOptions,
  AgentRunResult,
  DockerRunner,
  DockerVolumeMount,
} from "./types.js";

export type RunBoundAgentOptions = AgentRunBindingsOptions & {
  uid?: number;
  gid?: number;
};

export async function runBoundAgent(
  binding: AgentBinding,
  options: RunBoundAgentOptions,
  dockerRunner: DockerRunner = runDocker,
): Promise<AgentRunResult> {
  const uid = options.uid ?? process.getuid?.() ?? 0;
  const gid = options.gid ?? process.getgid?.() ?? 0;
  const prepared = await binding.prepare({ workspace: options.workspace });

  const volumes: DockerVolumeMount[] = [
    { host: options.workspace, container: CONTAINER_WORKSPACE },
    ...(prepared.volumes ?? []),
  ];

  const env = prepared.env ?? {};
  const args = buildDockerRunArgs({
    image: options.image,
    uid,
    gid,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    envPassthrough: Object.keys(env),
    volumes,
    command: binding.command({
      prompt: options.prompt,
      ...(options.model !== undefined ? { model: options.model } : {}),
    }),
  });

  const result = await dockerRunner(args, { env });

  if (result.exitCode !== 0) {
    throw agentRunError({
      agent: binding.displayName,
      image: options.image,
      result,
      detail: binding.describeFailure?.(result.stdout),
    });
  }

  return binding.parseResult(result.stdout);
}
