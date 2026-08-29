#!/usr/bin/env node
/**
 * Compute the next semver from a base version and comma-separated PR labels.
 * Labels: major > minor > patch (default).
 * Usage: next-version.mjs <baseVersion> [label,label,...]
 * Prints the next version to stdout.
 */
const [baseVersion, labelsCsv = ""] = process.argv.slice(2);

if (!baseVersion || !/^\d+\.\d+\.\d+$/.test(baseVersion)) {
  console.error(`Invalid base version: ${baseVersion ?? "(missing)"}`);
  process.exit(1);
}

const labels = new Set(
  labelsCsv
    .split(",")
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean),
);

const [major, minor, patch] = baseVersion.split(".").map(Number);

let next;
if (labels.has("major")) {
  next = `${major + 1}.0.0`;
} else if (labels.has("minor")) {
  next = `${major}.${minor + 1}.0`;
} else {
  next = `${major}.${minor}.${patch + 1}`;
}

process.stdout.write(`${next}\n`);
