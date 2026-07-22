import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const gateCMigrationPath = join(
  migrationsDirectory,
  "20260720172700_enforce_organization_memberships_role_not_null.sql",
);
const gateCMigrationSql = readFileSync(gateCMigrationPath, "utf8");
const normalizedSql = gateCMigrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("organization memberships role Gate C migration", () => {
  it("uses the approved Gate C migration filename", () => {
    expect(gateCMigrationPath).toContain(
      "20260720172700_enforce_organization_memberships_role_not_null.sql",
    );
  });

  it("guards against existing membership rows with null role", () => {
    expectMigrationToMatch(
      /if exists \( select 1 from public\.organization_memberships where role is null \)/,
    );
    expect(normalizedSql).toContain("from public.organization_memberships");
    expect(normalizedSql).toContain("where role is null");
  });

  it("raises an exception when null role rows exist", () => {
    expectMigrationToMatch(/raise exception/);
    expect(gateCMigrationSql).toContain(
      "organization_memberships.role must be assigned for every existing membership before Gate C enforcement",
    );
  });

  it("sets organization_memberships.role to NOT NULL", () => {
    expectMigrationToMatch(
      /alter table public\.organization_memberships alter column role set not null/,
    );
  });

  it("does not add a default for role", () => {
    expect(normalizedSql).not.toMatch(/set default/);
    expect(normalizedSql).not.toMatch(/role text default/);
  });

  it("does not update organization_memberships rows", () => {
    expect(normalizedSql).not.toMatch(/\bupdate\s+public\.organization_memberships\b/);
  });

  it("does not automatically assign owner", () => {
    expect(normalizedSql).not.toMatch(/set role = 'owner'/);
    expect(normalizedSql).not.toMatch(/set role='owner'/);
    expect(normalizedSql).not.toMatch(/role = 'owner'/);
  });

  it("does not insert memberships", () => {
    expect(normalizedSql).not.toMatch(/\binsert\s+into\s+public\.organization_memberships\b/);
  });

  it("does not enforce ownership for empty organizations", () => {
    expect(normalizedSql).not.toMatch(/from public\.organizations/);
    expect(normalizedSql).not.toMatch(/organizations o/);
    expect(normalizedSql).not.toMatch(/role = 'owner'/);
    expect(normalizedSql).not.toMatch(/at least one owner/);
    expect(normalizedSql).not.toMatch(/zero memberships/);
  });

  it("preserves the existing organization_memberships_role_valid check constraint", () => {
    expect(normalizedSql).not.toMatch(
      /drop constraint organization_memberships_role_valid/,
    );
    expect(normalizedSql).not.toMatch(
      /alter table public\.organization_memberships drop constraint/,
    );
    expect(normalizedSql).not.toMatch(
      /add constraint organization_memberships_role_valid/,
    );
  });

  it("does not add role helper functions", () => {
    expect(normalizedSql).not.toMatch(/create or replace function/);
    expect(normalizedSql).not.toMatch(/has_org_role/);
    expect(normalizedSql).not.toMatch(/current_membership_role/);
  });

  it("does not add INSERT, UPDATE, or DELETE RLS policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/for insert/);
    expect(normalizedSql).not.toMatch(/for update/);
    expect(normalizedSql).not.toMatch(/for delete/);
  });
});
