import { spawn } from "node:child_process";

/** Injected into agent containers so nested DooD runs know their parent name. */
export const CLANKER_DOCKER_NAME_ENV = "CLANKER_DOCKER_NAME";

/** Root of the cancel tree (outermost container name); nested runs inherit unchanged. */
export const CLANKER_DOCKER_ROOT_ENV = "CLANKER_DOCKER_ROOT";

export const CLANKER_LABEL_NAME = "clanker.name";
export const CLANKER_LABEL_PARENT = "clanker.parent";
export const CLANKER_LABEL_ROOT = "clanker.root";

export type DockerCliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type DockerCli = (args: string[]) => Promise<DockerCliResult>;

const defaultDockerCli: DockerCli = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: Error) => {
      reject(error);
    });
    child.on("close", (exitCode: number | null) => {
      resolve({ exitCode, stdout, stderr });
    });
  });

/**
 * Force-remove `name` and any DooD descendants labeled `clanker.parent=<name>`.
 * Children are removed first so nested token-burning containers do not survive.
 */
export async function forceRemoveContainerTree(
  name: string,
  dockerCli: DockerCli = defaultDockerCli,
): Promise<void> {
  const children = await listChildContainerNames(name, dockerCli);
  for (const child of children) {
    await forceRemoveContainerTree(child, dockerCli);
  }
  await dockerCli(["rm", "-f", name]);
}

async function listChildContainerNames(parentName: string, dockerCli: DockerCli): Promise<string[]> {
  const result = await dockerCli([
    "ps",
    "-a",
    "--filter",
    `label=${CLANKER_LABEL_PARENT}=${parentName}`,
    "--format",
    "{{.Names}}",
  ]);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Read inherited cancel identity from the process environment. */
export function readCancelIdentity(env: NodeJS.ProcessEnv = process.env): {
  parentName: string | undefined;
  rootName: string | undefined;
} {
  const parent = env[CLANKER_DOCKER_NAME_ENV];
  const root = env[CLANKER_DOCKER_ROOT_ENV];
  return {
    parentName: parent !== undefined && parent !== "" ? parent : undefined,
    rootName: root !== undefined && root !== "" ? root : undefined,
  };
}
