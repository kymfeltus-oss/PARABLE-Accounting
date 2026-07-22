import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.join(process.cwd(), "src");

const FORBIDDEN_RUNTIME_PATTERNS = [
  /development-preview-data/,
  /demo-data/,
  /sample-data/,
  /from\s+["'][^"']*mock-data/,
  /import\s*\(\s*["'][^"']*mock-data/,
];

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }

      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("production data source audit", () => {
  it("does not import runtime preview, demo, mock-data, or sample-data modules", () => {
    const runtimeViolations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");

      for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
        if (pattern.test(contents)) {
          runtimeViolations.push(
            `${path.relative(process.cwd(), filePath)} matched ${pattern}`,
          );
        }
      }
    }

    expect(runtimeViolations).toEqual([]);
  });
});
