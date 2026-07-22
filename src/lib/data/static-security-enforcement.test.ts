import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const DATA_DIRECTORY = path.join(process.cwd(), "src/lib/data");
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

function readProductionSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readRepositorySource(fileName: string): string {
  return readFileSync(path.join(DATA_DIRECTORY, fileName), "utf8");
}

function isClientComponent(contents: string): boolean {
  return contents.includes('"use client"') || contents.includes("'use client'");
}

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);

  if (start === -1) {
    throw new Error(`Missing function signature: ${signature}`);
  }

  const nextExport = source.indexOf("\nexport ", start + signature.length);
  const end = nextExport === -1 ? source.length : nextExport;

  return source.slice(start, end);
}

describe("Phase 4 Step 9B static security enforcement", () => {
  it("1. keeps zero production repository imports of @/lib/supabase/admin", () => {
    const violations: string[] = [];

    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readRepositorySource(fileName);

      if (contents.includes('from "@/lib/supabase/admin"')) {
        violations.push(fileName);
      }
    }

    expect(violations).toEqual([]);
  });

  it("2. keeps zero production repository references to createAdminSupabaseClient", () => {
    const violations: string[] = [];

    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readRepositorySource(fileName);

      if (contents.includes("createAdminSupabaseClient")) {
        violations.push(fileName);
      }
    }

    expect(violations).toEqual([]);
  });

  it("3. requires all 18 repositories to import createServerSupabaseClient from @/lib/supabase/server", () => {
    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readRepositorySource(fileName);

      expect(contents, fileName).toContain(
        'import { createServerSupabaseClient } from "@/lib/supabase/server"',
      );
    }
  });

  it("4. requires all 18 repositories to await createServerSupabaseClient()", () => {
    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readRepositorySource(fileName);

      expect(contents, fileName).toContain("await createServerSupabaseClient()");
    }
  });

  it("5. keeps Client Components from importing @/lib/supabase/admin", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");

      if (!isClientComponent(contents)) {
        continue;
      }

      if (contents.includes("@/lib/supabase/admin")) {
        violations.push(path.relative(process.cwd(), filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  it("6. keeps Client Components from importing server-only repository/admin infrastructure", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");

      if (!isClientComponent(contents)) {
        continue;
      }

      const relativePath = path.relative(process.cwd(), filePath);

      if (contents.includes("@/lib/supabase/admin")) {
        violations.push(`${relativePath} imports admin client`);
      }

      if (contents.includes("@/lib/supabase/server")) {
        violations.push(`${relativePath} imports server client`);
      }

      if (/@\/lib\/data\/.*-repository/.test(contents)) {
        const runtimeRepositoryImports = contents
          .split("\n")
          .filter(
            (line) =>
              /@\/lib\/data\/.*-repository/.test(line) &&
              !/^\s*import\s+type\b/.test(line),
          );

        if (runtimeRepositoryImports.length > 0) {
          violations.push(`${relativePath} imports data repository`);
        }
      }

      if (contents.includes('import "server-only"')) {
        violations.push(`${relativePath} imports server-only marker`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("7. keeps SUPABASE_SERVICE_ROLE_KEY in approved server-only admin infrastructure only", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

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

  it("8. keeps repositories free of PARABLE_ORGANIZATION_ID references", () => {
    const violations: string[] = [];

    for (const fileName of SERVER_CLIENT_REPOSITORIES) {
      const contents = readRepositorySource(fileName);

      if (contents.includes("PARABLE_ORGANIZATION_ID")) {
        violations.push(fileName);
      }
    }

    expect(violations).toEqual([]);
  });

  it("9. keeps organization-context authenticated path membership-backed without env fallback", () => {
    const organizationContext = readProductionSource("src/lib/data/organization-context.ts");

    expect(organizationContext).toContain("export function getConfiguredOrganizationId()");
    expect(organizationContext).toContain("getUserOrganizationMemberships(userId)");

    const resolveContextBody = extractFunctionBody(
      organizationContext,
      "export async function resolveOrganizationContext(",
    );
    const resolveForUserBody = extractFunctionBody(
      organizationContext,
      "export async function resolveOrganizationContextForAuthenticatedUser()",
    );
    const getCurrentOrgBody = extractFunctionBody(
      organizationContext,
      "export async function getCurrentOrganizationId()",
    );

    for (const [label, body, expectations] of [
      [
        "resolveOrganizationContext",
        resolveContextBody,
        { callsMembershipLookup: true },
      ],
      [
        "resolveOrganizationContextForAuthenticatedUser",
        resolveForUserBody,
        { callsMembershipLookup: false },
      ],
      [
        "getCurrentOrganizationId",
        getCurrentOrgBody,
        { callsMembershipLookup: false },
      ],
    ] as const) {
      if (expectations.callsMembershipLookup) {
        expect(body, label).toContain("getUserOrganizationMemberships");
      }

      expect(body, label).not.toContain("getConfiguredOrganizationId");
      expect(body, label).not.toContain("PARABLE_ORGANIZATION_ID");
    }

    expect(resolveForUserBody).toContain("getAuthenticatedUser()");
    expect(resolveForUserBody).toContain("resolveOrganizationContext(user.id)");
    expect(getCurrentOrgBody).toContain("resolveOrganizationContextForAuthenticatedUser()");
    expect(organizationContext).not.toMatch(/searchParams|headers\(|cookies\(/);
  });

  it("10. keeps organization-membership-repository on authenticated server client with user_id scope", () => {
    const membershipRepository = readProductionSource(
      "src/lib/data/organization-membership-repository.ts",
    );

    expect(membershipRepository).toContain(
      'import { createServerSupabaseClient } from "@/lib/supabase/server"',
    );
    expect(membershipRepository).toContain("await createServerSupabaseClient()");
    expect(membershipRepository).not.toContain("createAdminSupabaseClient");
    expect(membershipRepository).not.toContain('from "@/lib/supabase/admin"');
    expect(membershipRepository).toContain('.eq("user_id", scopedUserId)');
    expect(membershipRepository).not.toMatch(
      /function getUserOrganizationMemberships\([^)]*organizationId/,
    );
  });

  it("11. preserves getConfiguredOrganizationId legacy helper without using it in authenticated runtime", () => {
    const organizationContext = readProductionSource("src/lib/data/organization-context.ts");
    const dataIndex = readProductionSource("src/lib/data/index.ts");

    expect(organizationContext).toContain("export function getConfiguredOrganizationId()");
    expect(dataIndex).toContain("getConfiguredOrganizationId");

    const getCurrentOrgBody = extractFunctionBody(
      organizationContext,
      "export async function getCurrentOrganizationId()",
    );

    expect(getCurrentOrgBody).not.toContain("getConfiguredOrganizationId()");
  });

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

      if (relativePath === ADMIN_HELPER_RELATIVE_PATH) {
        continue;
      }

      violations.push(relativePath);
    }

    expect(violations).toEqual([]);
  });
});
