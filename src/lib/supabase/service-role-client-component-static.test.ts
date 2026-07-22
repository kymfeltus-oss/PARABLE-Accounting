import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const ADMIN_HELPER_RELATIVE_PATH = "src/lib/supabase/admin.ts";

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

function isClientComponent(contents: string): boolean {
  return contents.includes('"use client"') || contents.includes("'use client'");
}

function getClientComponentFiles(): string[] {
  return collectSourceFiles(SOURCE_ROOT).filter((filePath) => {
    if (TEST_FILE_PATTERN.test(filePath)) {
      return false;
    }

    return isClientComponent(readFileSync(filePath, "utf8"));
  });
}

describe("service-role and client-component static enforcement", () => {
  const clientComponentFiles = getClientComponentFiles();

  it("records the number of production Client Component files scanned", () => {
    expect(clientComponentFiles.length).toBeGreaterThan(0);
  });

  it("does not allow Client Components to import @/lib/supabase/admin", () => {
    const violations: string[] = [];

    for (const filePath of clientComponentFiles) {
      const contents = readFileSync(filePath, "utf8");

      if (contents.includes("@/lib/supabase/admin")) {
        violations.push(path.relative(process.cwd(), filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not allow Client Components to reference createAdminSupabaseClient", () => {
    const violations: string[] = [];

    for (const filePath of clientComponentFiles) {
      const contents = readFileSync(filePath, "utf8");

      if (contents.includes("createAdminSupabaseClient")) {
        violations.push(path.relative(process.cwd(), filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  it("allows SUPABASE_SERVICE_ROLE_KEY only in admin.ts and test files", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      if (relativePath === ADMIN_HELPER_RELATIVE_PATH) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");

      if (contents.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not allow NEXT_PUBLIC_* variables to contain or reference SERVICE_ROLE", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

      if (/NEXT_PUBLIC_.*SERVICE_ROLE/.test(contents)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});

export { getClientComponentFiles };
