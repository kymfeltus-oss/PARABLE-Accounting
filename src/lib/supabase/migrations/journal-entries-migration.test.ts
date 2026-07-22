import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const journalEntriesMigrationFiles = readdirSync(migrationsDirectory).filter(
  (file) => file.endsWith("_create_journal_entries.sql"),
);
const migrationSql =
  journalEntriesMigrationFiles.length === 1
    ? readFileSync(
        join(migrationsDirectory, journalEntriesMigrationFiles[0]),
        "utf8",
      )
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("journal entries migration", () => {
  it("has exactly one create_journal_entries migration file", () => {
    expect(journalEntriesMigrationFiles).toHaveLength(1);
  });

  it("creates public.journal_entries with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.journal_entries/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires an organization id with a cascading organizations foreign key", () => {
    expectMigrationToMatch(/organization_id uuid not null/);
    expectMigrationToMatch(
      /constraint journal_entries_organization_id_fkey foreign key \(organization_id\) references public\.organizations\(id\) on delete cascade/,
    );
  });

  it("requires an accounting period id with restricted deletion", () => {
    expectMigrationToMatch(/accounting_period_id uuid not null/);
    expectMigrationToMatch(
      /constraint journal_entries_accounting_period_id_fkey foreign key \(accounting_period_id\) references public\.accounting_periods\(id\) on delete restrict/,
    );
    expect(normalizedSql).not.toMatch(
      /foreign key \(accounting_period_id\) references public\.accounting_periods\(id\) on delete cascade/,
    );
  });

  it("requires entry numbers, protects against blanks, and scopes uniqueness to organization", () => {
    expectMigrationToMatch(/entry_number text not null/);
    expectMigrationToMatch(
      /constraint journal_entries_entry_number_not_blank check/,
    );
    expectMigrationToMatch(/char_length\(btrim\(entry_number\)\) > 0/);
    expectMigrationToMatch(
      /constraint journal_entries_organization_number_key unique \(organization_id, entry_number\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*entry_number\s*\)/);
  });

  it("requires entry dates without a default", () => {
    expectMigrationToMatch(/entry_date date not null/);
    expect(normalizedSql).not.toMatch(/entry_date date not null default/);
  });

  it("requires descriptions and protects against blanks", () => {
    expectMigrationToMatch(/description text not null/);
    expectMigrationToMatch(
      /constraint journal_entries_description_not_blank check/,
    );
    expectMigrationToMatch(/char_length\(btrim\(description\)\) > 0/);
  });

  it("defines the approved source type values and default", () => {
    expectMigrationToMatch(/source_type text not null default 'manual'/);
    expectMigrationToMatch(/constraint journal_entries_source_type_valid check/);
    expectMigrationToMatch(
      /source_type in \( 'manual', 'giving', 'banking', 'expense', 'bill', 'adjustment', 'closing' \)/,
    );
    expect(normalizedSql).not.toContain("'ai'");
    expect(normalizedSql).not.toContain("'import'");
    expect(normalizedSql).not.toContain("'payroll'");
    expect(normalizedSql).not.toContain("'budget'");
  });

  it("defines the approved status values and default", () => {
    expectMigrationToMatch(/status text not null default 'draft'/);
    expectMigrationToMatch(/constraint journal_entries_status_valid check/);
    expectMigrationToMatch(/status in \('draft', 'posted', 'reversed'\)/);
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(
      /alter table public\.journal_entries enable row level security/,
    );
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not reference auth users or include monetary header columns", () => {
    const disallowedMonetaryColumns = [
      "debit",
      "credit",
      "amount",
      "total_debits",
      "total_credits",
      "balance",
    ];

    expect(normalizedSql).not.toContain("auth.users");

    for (const columnName of disallowedMonetaryColumns) {
      expect(normalizedSql).not.toContain(columnName);
    }
  });

  it("does not create journal lines, transactions, posting functions, or triggers", () => {
    expect(normalizedSql).not.toMatch(
      /create\s+table\s+(public\.)?journal_entry_lines\b/,
    );
    expect(normalizedSql).not.toMatch(
      /create\s+table\s+(public\.)?transactions\b/,
    );
    expect(normalizedSql).not.toMatch(/create function/);
    expect(normalizedSql).not.toMatch(/create trigger/);
    expect(normalizedSql).not.toMatch(/create sequence/);
  });

  it("does not create unrelated future domain tables", () => {
    const futureDomainTables = [
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
