import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const roleMigrationPath = join(
  migrationsDirectory,
  "20260720171000_add_organization_memberships_role.sql",
);
const roleMigrationSql = readFileSync(roleMigrationPath, "utf8");
const normalizedSql = roleMigrationSql.toLowerCase().replace(/\s+/g, " ").trim();

const ALLOWED_ROLES = ["owner", "accountant", "staff", "viewer"] as const;

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("organization memberships role Gate A migration", () => {
  it("uses the approved Gate A migration filename", () => {
    expect(roleMigrationPath).toContain(
      "20260720171000_add_organization_memberships_role.sql",
    );
  });

  it("adds a nullable role column to public.organization_memberships", () => {
    expectMigrationToMatch(
      /alter table public\.organization_memberships add column role text/,
    );
    expect(normalizedSql).not.toMatch(/add column role text not null/);
    expect(normalizedSql).not.toMatch(/alter column role set not null/);
  });

  it("does not define a default for role", () => {
    expect(normalizedSql).not.toMatch(/role text default/);
    expect(normalizedSql).not.toMatch(/set default/);
  });

  it("adds the organization_memberships_role_valid check constraint", () => {
    expectMigrationToMatch(
      /add constraint organization_memberships_role_valid check \( role is null or role in \( 'owner', 'accountant', 'staff', 'viewer' \) \)/,
    );
  });

  it("allows exactly the approved role values", () => {
    for (const role of ALLOWED_ROLES) {
      expect(normalizedSql).toContain(`'${role}'`);
    }

    expect(normalizedSql).not.toMatch(/'admin'/);
    expect(normalizedSql).not.toMatch(/'contributor'/);
    expect(normalizedSql).not.toMatch(/'member'/);
  });

  it("temporarily allows null role values during Gate A", () => {
    expectMigrationToMatch(/role is null or role in/);
  });

  it("documents that role must be set explicitly with no default", () => {
    expect(roleMigrationSql).toContain(
      "comment on column public.organization_memberships.role is",
    );
    expect(roleMigrationSql).toContain("Must be set explicitly; no default.");
  });

  it("does not update existing organization_memberships rows", () => {
    expect(normalizedSql).not.toMatch(/\bupdate\s+public\.organization_memberships\b/);
  });

  it("does not automatically assign owner to existing memberships", () => {
    expect(normalizedSql).not.toMatch(/set role = 'owner'/);
    expect(normalizedSql).not.toMatch(/set role='owner'/);
    expect(normalizedSql).not.toMatch(/role = 'owner'/);
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

  it("does not modify the historical organization_memberships create migration", () => {
    const createMigrationSql = readFileSync(
      join(migrationsDirectory, "20260718025545_create_organization_memberships.sql"),
      "utf8",
    );
    const normalizedCreateSql = createMigrationSql
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    expect(normalizedCreateSql).not.toContain("role text");
    expect(normalizedCreateSql).not.toMatch(
      /constraint organization_memberships_role_valid/,
    );
  });
});
