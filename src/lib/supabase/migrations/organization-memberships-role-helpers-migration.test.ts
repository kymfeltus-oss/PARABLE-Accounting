import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260720173000_add_membership_role_helpers_and_owner_visibility.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

const OTHER_TABLES = [
  "organizations",
  "funds",
  "accounts",
  "journal_entries",
  "bills",
  "expenses",
  "compliance_items",
  "exceptions",
] as const;

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("organization memberships role helpers and owner visibility migration", () => {
  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain(
      "20260720173000_add_membership_role_helpers_and_owner_visibility.sql",
    );
  });

  it("creates current_membership_role as SECURITY DEFINER with hardened search_path", () => {
    expectMigrationToMatch(
      /create or replace function public\.current_membership_role\( target_organization_id uuid \)/,
    );
    expectMigrationToMatch(/returns text/);
    expectMigrationToMatch(/stable/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("scopes current_membership_role to auth.uid() and organization_memberships", () => {
    expect(normalizedSql).toContain("from public.organization_memberships membership");
    expect(normalizedSql).toContain("membership.user_id = auth.uid()");
    expect(normalizedSql).toContain("membership.organization_id = target_organization_id");
    expect(normalizedSql).toContain("select membership.role");
  });

  it("hardens current_membership_role execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.current_membership_role(uuid) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.current_membership_role(uuid) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.current_membership_role(uuid) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.current_membership_role\(uuid\) to anon/,
    );
  });

  it("creates has_org_role as SECURITY DEFINER with hardened search_path", () => {
    expectMigrationToMatch(
      /create or replace function public\.has_org_role\( target_organization_id uuid, allowed_roles text\[\] \)/,
    );
    expectMigrationToMatch(/returns boolean/);
    expect(normalizedSql).toMatch(/has_org_role[\s\S]*security definer/);
    expect(normalizedSql).toMatch(/has_org_role[\s\S]*set search_path = ''/);
  });

  it("implements has_org_role via current_membership_role and allowed_roles", () => {
    expect(normalizedSql).toContain(
      "select public.current_membership_role(target_organization_id) = any (allowed_roles)",
    );
  });

  it("hardens has_org_role execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.has_org_role(uuid, text[]) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.has_org_role(uuid, text[]) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.has_org_role(uuid, text[]) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.has_org_role\(uuid, text\[\]\) to anon/,
    );
  });

  it("preserves self access and grants owner org-wide membership SELECT visibility", () => {
    expect(migrationSql).toContain(
      "drop policy organization_memberships_select_self on public.organization_memberships",
    );
    expectMigrationToMatch(
      /create policy organization_memberships_select_self on public\.organization_memberships for select to authenticated using \( user_id = auth\.uid\(\) or public\.has_org_role\(organization_id, array\['owner'\]\) \)/,
    );
  });

  it("does not grant org-wide membership listing to accountant, staff, or viewer", () => {
    expect(normalizedSql).not.toMatch(
      /has_org_role\(organization_id, array\['accountant'\]\)/,
    );
    expect(normalizedSql).not.toMatch(
      /has_org_role\(organization_id, array\['staff'\]\)/,
    );
    expect(normalizedSql).not.toMatch(
      /has_org_role\(organization_id, array\['viewer'\]\)/,
    );
    expect(normalizedSql).not.toMatch(/array\['owner', 'accountant'/);
    expect(normalizedSql).not.toMatch(/array\['owner', 'staff'/);
    expect(normalizedSql).not.toMatch(/array\['owner', 'viewer'/);
  });

  it("does not add INSERT, UPDATE, or DELETE policies", () => {
    expect(normalizedSql).not.toMatch(/for insert/);
    expect(normalizedSql).not.toMatch(/for update/);
    expect(normalizedSql).not.toMatch(/for delete/);
  });

  it("changes only organization_memberships SELECT policy behavior", () => {
    expect(normalizedSql).not.toMatch(/drop policy organizations_select_member/);
    expect(normalizedSql).not.toMatch(/drop policy funds_select_member/);
    expect(normalizedSql).not.toMatch(/create policy organizations_select_member/);
    expect(normalizedSql).not.toMatch(/create policy funds_select_member/);

    const createPolicyCount = (migrationSql.match(/create policy/gi) ?? []).length;
    expect(createPolicyCount).toBe(1);
  });

  it("does not modify SELECT policies on other tables", () => {
    for (const table of OTHER_TABLES) {
      expect(normalizedSql).not.toMatch(new RegExp(`drop policy .* on public\\.${table}`));
      expect(normalizedSql).not.toMatch(new RegExp(`create policy .* on public\\.${table}`));
    }
  });
});
