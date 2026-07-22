import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const ADMIN_HELPER_RELATIVE_PATH = "src/lib/supabase/admin.ts";

const SERVER_CLIENT_REPOSITORIES = [
  "accounting-repository.ts",
  "ai-close-repository.ts",
  "audit-vault-repository.ts",
  "banking-repository.ts",
  "bills-repository.ts",
  "budgets-repository.ts",
  "compliance-repository.ts",
  "dashboard-repository.ts",
  "exceptions-repository.ts",
  "expenses-repository.ts",
  "funds-repository.ts",
  "giving-repository.ts",
  "members-repository.ts",
  "organization-membership-repository.ts",
  "reports-repository.ts",
  "settings-repository.ts",
  "transactions-repository.ts",
  "vendors-repository.ts",
] as const;

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

describe("admin client elimination audit", () => {
  it("allows createAdminSupabaseClient only in approved admin infrastructure", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
      const contents = readFileSync(filePath, "utf8");

      if (!contents.includes("createAdminSupabaseClient")) {
        continue;
      }

      if (relativePath.replace(/\\/g, "/") === ADMIN_HELPER_RELATIVE_PATH) {
        continue;
      }

      violations.push(relativePath);
    }

    expect(violations).toEqual([]);
  });

  it("keeps zero production repository imports of the admin client", () => {
    const violations: string[] = [];

    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readFileSync(
        path.join(process.cwd(), "src/lib/data", fileName),
        "utf8",
      );

      if (contents.includes('from "@/lib/supabase/admin"')) {
        violations.push(fileName);
      }
      if (contents.includes("createAdminSupabaseClient")) {
        violations.push(`${fileName} calls createAdminSupabaseClient`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps all repositories on the authenticated server client", () => {
    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readFileSync(
        path.join(process.cwd(), "src/lib/data", fileName),
        "utf8",
      );

      expect(contents).toContain('from "@/lib/supabase/server"');
      expect(contents).toContain("await createServerSupabaseClient()");
    }
  });

  it("keeps repositories free of PARABLE_ORGANIZATION_ID and service-role usage", () => {
    const violations: string[] = [];

    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readFileSync(
        path.join(process.cwd(), "src/lib/data", fileName),
        "utf8",
      );

      if (contents.includes("PARABLE_ORGANIZATION_ID")) {
        violations.push(`${fileName} references PARABLE_ORGANIZATION_ID`);
      }
      if (contents.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        violations.push(`${fileName} references SUPABASE_SERVICE_ROLE_KEY`);
      }
      if (contents.includes('from "@/lib/supabase/client"')) {
        violations.push(`${fileName} imports browser client`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps organization-context authenticated path off PARABLE_ORGANIZATION_ID", () => {
    const organizationContext = readFileSync(
      path.join(process.cwd(), "src/lib/data/organization-context.ts"),
      "utf8",
    );
    const membershipRepository = readFileSync(
      path.join(process.cwd(), "src/lib/data/organization-membership-repository.ts"),
      "utf8",
    );

    expect(organizationContext).not.toContain("createAdminSupabaseClient");
    expect(
      organizationContext.slice(
        organizationContext.indexOf("export async function getCurrentOrganizationId"),
        organizationContext.indexOf("export type { UserOrganizationSummary"),
      ),
    ).not.toContain("getConfiguredOrganizationId");

    expect(membershipRepository).toContain('.eq("user_id", scopedUserId)');
    expect(membershipRepository).not.toMatch(
      /function getUserOrganizationMemberships\([^)]*organizationId/,
    );
    expect(membershipRepository).not.toContain("createAdminSupabaseClient");
  });
});
