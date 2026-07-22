import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DATA_DIRECTORY = path.join(process.cwd(), "src/lib/data");

function readProductionSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
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

describe("organization-context static security enforcement", () => {
  const organizationContext = readProductionSource(
    "src/lib/data/organization-context.ts",
  );
  const membershipRepository = readProductionSource(
    "src/lib/data/organization-membership-repository.ts",
  );

  it("preserves legacy getConfiguredOrganizationId() without using it in authenticated runtime", () => {
    expect(organizationContext).toContain("export function getConfiguredOrganizationId()");
  });

  it("does not allow getCurrentOrganizationId() to call getConfiguredOrganizationId()", () => {
    const functionBody = extractFunctionBody(
      organizationContext,
      "export async function getCurrentOrganizationId()",
    );

    expect(functionBody).not.toContain("getConfiguredOrganizationId(");
  });

  it("does not allow authenticated organization resolution to read PARABLE_ORGANIZATION_ID", () => {
    const authenticatedResolutionBodies = [
      extractFunctionBody(
        organizationContext,
        "export async function resolveOrganizationContext(",
      ),
      extractFunctionBody(
        organizationContext,
        "export async function resolveOrganizationContextForAuthenticatedUser()",
      ),
      extractFunctionBody(
        organizationContext,
        "export async function getCurrentOrganizationId()",
      ),
    ];

    for (const body of authenticatedResolutionBodies) {
      expect(body).not.toContain("PARABLE_ORGANIZATION_ID");
      expect(body).not.toContain("getConfiguredOrganizationId(");
    }
  });

  it("requires organization-membership-repository.ts to use createServerSupabaseClient", () => {
    expect(membershipRepository).toContain("createServerSupabaseClient");
    expect(membershipRepository).toContain(
      'import { createServerSupabaseClient } from "@/lib/supabase/server"',
    );
    expect(membershipRepository).toContain("await createServerSupabaseClient()");
  });

  it("does not allow organization-membership-repository.ts to reference createAdminSupabaseClient", () => {
    expect(membershipRepository).not.toContain("createAdminSupabaseClient");
    expect(membershipRepository).not.toContain('from "@/lib/supabase/admin"');
  });

  it("requires organization-membership-repository.ts to scope membership lookup by user_id", () => {
    expect(membershipRepository).toContain('.eq("user_id", scopedUserId)');
  });

  it("does not allow organization-membership-repository.ts to accept organizationId as an input parameter", () => {
    expect(membershipRepository).not.toMatch(
      /function getUserOrganizationMemberships\([^)]*organizationId/,
    );
  });
});
