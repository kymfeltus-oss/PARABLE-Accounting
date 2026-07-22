import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AUTH_ROOT = path.join(process.cwd(), "src/components/auth");
const AUTH_APP_ROOT = path.join(process.cwd(), "src/app/login");
const CREATE_ACCOUNT_APP_ROOT = path.join(process.cwd(), "src/app/create-account");

function collectAuthSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectAuthSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("auth UI security source scans", () => {
  it("uses browser client only in auth UI components", () => {
    const authComponentFiles = collectAuthSourceFiles(AUTH_ROOT);

    for (const filePath of authComponentFiles) {
      const contents = readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);

      expect(contents, `${relativePath} must not import admin client`).not.toContain(
        "@/lib/supabase/admin",
      );
      expect(contents, `${relativePath} must not reference service role key`).not.toContain(
        "SUPABASE_SERVICE_ROLE_KEY",
      );
      expect(contents, `${relativePath} must not reference PARABLE_ORGANIZATION_ID`).not.toMatch(
        /PARABLE_ORGANIZATION_ID|getConfiguredOrganizationId/,
      );

      if (contents.includes('"use client"') || contents.includes("'use client'")) {
        expect(contents, `${relativePath} should use browser client`).toContain(
          "createBrowserSupabaseClient",
        );
      }
    }
  });

  it("auth pages use server-side getAuthenticatedUser only", () => {
    for (const filePath of [
      path.join(AUTH_APP_ROOT, "page.tsx"),
      path.join(CREATE_ACCOUNT_APP_ROOT, "page.tsx"),
    ]) {
      const contents = readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);

      expect(contents, `${relativePath} should call getAuthenticatedUser`).toContain(
        "getAuthenticatedUser",
      );
      expect(contents, `${relativePath} must not import admin client`).not.toContain(
        "@/lib/supabase/admin",
      );
      expect(contents, `${relativePath} must not reference PARABLE_ORGANIZATION_ID`).not.toMatch(
        /PARABLE_ORGANIZATION_ID|getConfiguredOrganizationId/,
      );
    }
  });

  it("signup code does not create organization or membership rows", () => {
    const createAccountSource = readFileSync(
      path.join(AUTH_ROOT, "create-account-form.tsx"),
      "utf8",
    );

    expect(createAccountSource).not.toMatch(/organization_memberships/);
    expect(createAccountSource).not.toMatch(/organizations/);
    expect(createAccountSource).not.toMatch(/createAdminSupabaseClient/);
    expect(createAccountSource).not.toMatch(/\.insert\(/);
  });

  it("auth Client Components do not import admin.ts", () => {
    const clientAuthFiles = collectAuthSourceFiles(AUTH_ROOT).filter((filePath) => {
      const contents = readFileSync(filePath, "utf8");
      return contents.includes('"use client"') || contents.includes("'use client'");
    });

    for (const filePath of clientAuthFiles) {
      const contents = readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);

      expect(contents, `${relativePath} must not import admin client`).not.toContain(
        "@/lib/supabase/admin",
      );
    }
  });
});
