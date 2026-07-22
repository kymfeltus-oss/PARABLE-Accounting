import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DATA_DIRECTORY = path.join(process.cwd(), "src/lib/data");

function getRepositoryFiles(): string[] {
  return readdirSync(DATA_DIRECTORY)
    .filter((fileName) => fileName.endsWith("-repository.ts"))
    .sort();
}

function readRepositorySource(fileName: string): string {
  return readFileSync(path.join(DATA_DIRECTORY, fileName), "utf8");
}

describe("repository admin-client static enforcement", () => {
  const repositoryFiles = getRepositoryFiles();

  it("scans every src/lib/data/*-repository.ts file", () => {
    expect(repositoryFiles.length).toBeGreaterThan(0);
  });

  it("does not allow any repository to import @/lib/supabase/admin", () => {
    const violations: string[] = [];

    for (const fileName of repositoryFiles) {
      const contents = readRepositorySource(fileName);

      if (contents.includes('from "@/lib/supabase/admin"')) {
        violations.push(fileName);
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not allow any repository to reference createAdminSupabaseClient", () => {
    const violations: string[] = [];

    for (const fileName of repositoryFiles) {
      const contents = readRepositorySource(fileName);

      if (contents.includes("createAdminSupabaseClient")) {
        violations.push(fileName);
      }
    }

    expect(violations).toEqual([]);
  });

  it("requires every repository to reference createServerSupabaseClient", () => {
    const violations: string[] = [];

    for (const fileName of repositoryFiles) {
      const contents = readRepositorySource(fileName);

      if (!contents.includes("createServerSupabaseClient")) {
        violations.push(fileName);
      }
    }

    expect(violations).toEqual([]);
  });
});
