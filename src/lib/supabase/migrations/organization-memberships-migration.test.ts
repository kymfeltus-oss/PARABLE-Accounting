import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const membershipMigrationFiles = readdirSync(migrationsDirectory).filter(
  (file) => file.endsWith("_create_organization_memberships.sql"),
);
const migrationSql =
  membershipMigrationFiles.length === 1
    ? readFileSync(
        join(migrationsDirectory, membershipMigrationFiles[0]),
        "utf8",
      )
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("organization memberships migration", () => {
  it("has exactly one create_organization_memberships migration file", () => {
    expect(membershipMigrationFiles).toHaveLength(1);
  });

  it("creates public.organization_memberships with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.organization_memberships/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires an organization id with a cascading organizations foreign key", () => {
    expectMigrationToMatch(/organization_id uuid not null/);
    expectMigrationToMatch(
      /constraint organization_memberships_organization_id_fkey foreign key \(organization_id\) references public\.organizations\(id\) on delete cascade/,
    );
  });

  it("stores a deferred user id without auth or profile references", () => {
    expectMigrationToMatch(/user_id uuid not null/);
    expect(normalizedSql).not.toContain("auth.users");
    expect(normalizedSql).not.toContain("public.profiles");
    expect(normalizedSql).not.toMatch(/create\s+table\s+public\.users\b/);
    expect(normalizedSql).not.toMatch(/create\s+table\s+public\.profiles\b/);
  });

  it("prevents duplicate organization user memberships only by pair", () => {
    expectMigrationToMatch(
      /constraint organization_memberships_organization_user_key unique \(organization_id, user_id\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*user_id\s*\)/);
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*organization_id\s*\)/);
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(
      /alter table public\.organization_memberships enable row level security/,
    );
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not include role, permission, or membership status columns", () => {
    expect(normalizedSql).not.toMatch(
      /\b(role|permission|permissions|access_level|is_admin|owner|accountant|viewer)\b/,
    );
    expect(normalizedSql).not.toMatch(
      /\b(status|active|inactive|invited|pending|suspended)\b/,
    );
  });

  it("does not create unrelated domain tables", () => {
    const futureDomainTables = [
      "members",
      "giving",
      "transactions",
      "accounts",
      "funds",
      "vendors",
      "expenses",
      "bills",
      "budgets",
      "journal_entries",
    ];

    for (const tableName of futureDomainTables) {
      expect(normalizedSql).not.toMatch(
        new RegExp(`create\\s+table\\s+(public\\.)?${tableName}\\b`),
      );
    }
  });
});
