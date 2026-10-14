import fs from "node:fs";
import path from "node:path";

export const OUTPUT_FILENAME = ".agentfield_output.json";

type ParseableSchema = {
  parse: (value: unknown) => unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasParse(value: unknown): value is ParseableSchema {
  return isRecord(value) && typeof value.parse === "function";
}

export function getOutputPath(workspace: string): string {
  return path.join(workspace, OUTPUT_FILENAME);
}

export function buildPromptSuffix(workspace: string): string {
  const outputPath = getOutputPath(workspace);
  return (
    `\n\nOUTPUT REQUIREMENTS:\n` +
    `When you are finished, write a single JSON object to ${outputPath} ` +
    `that satisfies the caller's schema. Do not wrap it in markdown. ` +
    `The file must be valid JSON.`
  );
}

export function readOutputFile(workspace: string): unknown | null {
  const outputPath = getOutputPath(workspace);
  if (!fs.existsSync(outputPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(outputPath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseAndValidate(workspace: string, schema: unknown): unknown | null {
  const data = readOutputFile(workspace);
  if (data === null) {
    return null;
  }
  if (!hasParse(schema)) {
    return data;
  }
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}
