import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const accountsMigrationFiles = readdirSync(migrationsDirectory).filter((file) =>
  file.endsWith("_create_accounts.sql"),
);
const migrationSql =
  accountsMigrationFiles.length === 1
    ? readFileSync(join(migrationsDirectory, accountsMigrationFiles[0]), "utf8")
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("accounts migration", () => {
  it("has exactly one create_accounts migration file", () => {
    expect(accountsMigrationFiles).toHaveLength(1);
  });

  it("creates public.accounts with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.accounts/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires an organization id with a cascading organizations foreign key", () => {
    expectMigrationToMatch(/organization_id uuid not null/);
    expectMigrationToMatch(
      /constraint accounts_organization_id_fkey foreign key \(organization_id\) references public\.organizations\(id\) on delete cascade/,
    );
  });

  it("supports nullable parent accounts with restricted deletion", () => {
    expectMigrationToMatch(/parent_account_id uuid[, ]/);
    expect(normalizedSql).not.toMatch(/parent_account_id uuid not null/);
    expectMigrationToMatch(
      /constraint accounts_parent_account_id_fkey foreign key \(parent_account_id\) references public\.accounts\(id\) on delete restrict/,
    );
    expect(normalizedSql).not.toMatch(
      /foreign key \(parent_account_id\) references public\.accounts\(id\) on delete cascade/,
    );
  });

  it("requires account codes, protects against blanks, and scopes uniqueness to organization", () => {
    expectMigrationToMatch(/code text not null/);
    expectMigrationToMatch(/constraint accounts_code_not_blank check/);
    expectMigrationToMatch(/char_length\(btrim\(code\)\) > 0/);
    expectMigrationToMatch(
      /constraint accounts_organization_code_key unique \(organization_id, code\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*code\s*\)/);
  });

  it("requires account names and protects against blanks without global uniqueness", () => {
    expectMigrationToMatch(/name text not null/);
    expectMigrationToMatch(/constraint accounts_name_not_blank check/);
    expectMigrationToMatch(/char_length\(btrim\(name\)\) > 0/);
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*name\s*\)/);
  });

  it("defines the approved nonprofit account types without equity", () => {
    expectMigrationToMatch(/account_type text not null/);
    expectMigrationToMatch(/constraint accounts_type_valid check/);
    expectMigrationToMatch(
      /account_type in \( 'asset', 'liability', 'net_asset', 'revenue', 'expense' \)/,
    );
    expect(normalizedSql).not.toContain("'equity'");
  });

  it("defines posting behavior as a boolean defaulting to true", () => {
    expectMigrationToMatch(/is_posting boolean not null default true/);
  });

  it("defines the approved status values and default", () => {
    expectMigrationToMatch(/status text not null default 'active'/);
    expectMigrationToMatch(/constraint accounts_status_valid check/);
    expectMigrationToMatch(/status in \('active', 'inactive'\)/);
    expect(normalizedSql).not.toContain("archived");
    expect(normalizedSql).not.toContain("deleted");
    expect(normalizedSql).not.toContain("closed");
    expect(normalizedSql).not.toContain("suspended");
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(
      /alter table public\.accounts enable row level security/,
    );
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not reference auth users or create balance columns", () => {
    const disallowedBalanceColumns = [
      "current_balance",
      "debit_balance",
      "credit_balance",
      "beginning_balance",
      "ending_balance",
    ];

    expect(normalizedSql).not.toContain("auth.users");

    for (const columnName of disallowedBalanceColumns) {
      expect(normalizedSql).not.toContain(columnName);
    }
  });

  it("does not create journal, transaction, or unrelated domain tables", () => {
    const futureDomainTables = [
      "journal_entries",
      "journal_entry_lines",
      "transactions",
      "members",
      "giving",
      "vendors",
      "expenses",
      "bills",
      "budgets",
    ];

    for (const tableName of futureDomainTables) {
      expect(normalizedSql).not.toMatch(
        new RegExp(`create\\s+table\\s+(public\\.)?${tableName}\\b`),
      );
    }
  });
});
