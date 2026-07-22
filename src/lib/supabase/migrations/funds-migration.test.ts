import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const fundsMigrationFiles = readdirSync(migrationsDirectory).filter((file) =>
  file.endsWith("_create_funds.sql"),
);
const migrationSql =
  fundsMigrationFiles.length === 1
    ? readFileSync(join(migrationsDirectory, fundsMigrationFiles[0]), "utf8")
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("funds migration", () => {
  it("has exactly one create_funds migration file", () => {
    expect(fundsMigrationFiles).toHaveLength(1);
  });

  it("creates public.funds with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.funds/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires an organization id with a cascading organizations foreign key", () => {
    expectMigrationToMatch(/organization_id uuid not null/);
    expectMigrationToMatch(
      /constraint funds_organization_id_fkey foreign key \(organization_id\) references public\.organizations\(id\) on delete cascade/,
    );
  });

  it("requires fund names, protects against blanks, and scopes uniqueness to organization", () => {
    expectMigrationToMatch(/name text not null/);
    expectMigrationToMatch(/constraint funds_name_not_blank check/);
    expectMigrationToMatch(/char_length\(btrim\(name\)\) > 0/);
    expectMigrationToMatch(
      /constraint funds_organization_name_key unique \(organization_id, name\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*name\s*\)/);
  });

  it("allows nullable fund codes, protects against blanks, and scopes uniqueness to organization", () => {
    expectMigrationToMatch(/code text[, ]/);
    expect(normalizedSql).not.toMatch(/code text not null/);
    expectMigrationToMatch(/constraint funds_code_not_blank check/);
    expectMigrationToMatch(
      /code is null or char_length\(btrim\(code\)\) > 0/,
    );
    expectMigrationToMatch(
      /constraint funds_organization_code_key unique \(organization_id, code\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*code\s*\)/);
  });

  it("defines the approved fund type values and default", () => {
    expectMigrationToMatch(/fund_type text not null default 'unrestricted'/);
    expectMigrationToMatch(/constraint funds_type_valid check/);
    expectMigrationToMatch(
      /fund_type in \('unrestricted', 'temporarily_restricted', 'permanently_restricted'\)/,
    );
    expect(normalizedSql).not.toContain("board_designated");
    expect(normalizedSql).not.toContain("donor_restricted");
  });

  it("defines the approved status values and default", () => {
    expectMigrationToMatch(/status text not null default 'active'/);
    expectMigrationToMatch(/constraint funds_status_valid check/);
    expectMigrationToMatch(/status in \('active', 'inactive'\)/);
    expect(normalizedSql).not.toContain("archived");
    expect(normalizedSql).not.toContain("deleted");
    expect(normalizedSql).not.toContain("suspended");
    expect(normalizedSql).not.toContain("pending");
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(/alter table public\.funds enable row level security/);
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not reference auth users or create balance columns", () => {
    const disallowedBalanceColumns = [
      "current_balance",
      "available_balance",
      "restricted_balance",
      "budget_balance",
    ];

    expect(normalizedSql).not.toContain("auth.users");

    for (const columnName of disallowedBalanceColumns) {
      expect(normalizedSql).not.toContain(columnName);
    }
  });

  it("does not create unrelated domain tables", () => {
    const futureDomainTables = [
      "members",
      "giving",
      "transactions",
      "accounts",
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
