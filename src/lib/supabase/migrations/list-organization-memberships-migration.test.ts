import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260805103000_list_organization_memberships.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

describe("list organization memberships RPC migration", () => {
  it("creates list_organization_memberships with email from auth.users", () => {
    expect(normalizedSql).toMatch(
      /create or replace function public\.list_organization_memberships\( target_organization_id uuid \)/,
    );
    expect(normalizedSql).toContain("left join auth.users");
    expect(normalizedSql).toContain("auth_user.email");
  });

  it("uses plpgsql, SECURITY DEFINER, and an empty search_path", () => {
    expect(normalizedSql).toContain("language plpgsql");
    expect(normalizedSql).toContain("security definer");
    expect(normalizedSql).toContain("set search_path = ''");
  });

  it("allows any organization member role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff', 'viewer'] )",
    );
  });

  it("hardens execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.list_organization_memberships(uuid) from public",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.list_organization_memberships(uuid) to authenticated",
    );
  });
});
