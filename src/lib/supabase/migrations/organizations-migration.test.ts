import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const organizationsMigrationFiles = readdirSync(migrationsDirectory).filter(
  (file) => file.endsWith("_create_organizations.sql"),
);
const migrationSql =
  organizationsMigrationFiles.length === 1
    ? readFileSync(
        join(migrationsDirectory, organizationsMigrationFiles[0]),
        "utf8",
      )
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("organizations migration", () => {
  it("has exactly one create_organizations migration file", () => {
    expect(organizationsMigrationFiles).toHaveLength(1);
  });

  it("creates public.organizations with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.organizations/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires organization name and protects against blank values", () => {
    expectMigrationToMatch(/name text not null/);
    expectMigrationToMatch(/constraint organizations_name_not_blank check/);
    expectMigrationToMatch(/char_length\(btrim\(name\)\) > 0/);
  });

  it("requires unique slug values with approved format protection", () => {
    expectMigrationToMatch(/slug text not null/);
    expectMigrationToMatch(/constraint organizations_slug_key unique \(slug\)/);
    expectMigrationToMatch(/constraint organizations_slug_format check/);
    expectMigrationToMatch(
      /slug ~ '\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$'/,
    );
  });

  it("defaults status to active and restricts allowed statuses", () => {
    expectMigrationToMatch(/status text not null default 'active'/);
    expectMigrationToMatch(/constraint organizations_status_valid check/);
    expectMigrationToMatch(/status in \('active', 'inactive'\)/);
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(
      /alter table public\.organizations enable row level security/,
    );
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not reference auth users or create unrelated domain tables", () => {
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

    expect(normalizedSql).not.toContain("auth.users");

    for (const tableName of futureDomainTables) {
      expect(normalizedSql).not.toMatch(
        new RegExp(`create\\s+table\\s+(public\\.)?${tableName}\\b`),
      );
    }
  });
});
