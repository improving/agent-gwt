export function parseAgentJsonOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (trimmed === "") {
    throw new Error("Agent produced empty stdout; expected JSON output");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent stdout was not valid JSON: ${detail}\nStdout:\n${stdout}`);
  }
}
