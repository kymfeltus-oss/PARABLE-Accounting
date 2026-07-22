import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const accountingPeriodsMigrationFiles = readdirSync(migrationsDirectory).filter(
  (file) => file.endsWith("_create_accounting_periods.sql"),
);
const migrationSql =
  accountingPeriodsMigrationFiles.length === 1
    ? readFileSync(
        join(migrationsDirectory, accountingPeriodsMigrationFiles[0]),
        "utf8",
      )
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("accounting periods migration", () => {
  it("has exactly one create_accounting_periods migration file", () => {
    expect(accountingPeriodsMigrationFiles).toHaveLength(1);
  });

  it("creates public.accounting_periods with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.accounting_periods/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires an organization id with a cascading organizations foreign key", () => {
    expectMigrationToMatch(/organization_id uuid not null/);
    expectMigrationToMatch(
      /constraint accounting_periods_organization_id_fkey foreign key \(organization_id\) references public\.organizations\(id\) on delete cascade/,
    );
  });

  it("requires period names and protects against blanks", () => {
    expectMigrationToMatch(/name text not null/);
    expectMigrationToMatch(/constraint accounting_periods_name_not_blank check/);
    expectMigrationToMatch(/char_length\(btrim\(name\)\) > 0/);
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*name\s*\)/);
  });

  it("requires start and end dates with a valid date range constraint", () => {
    expectMigrationToMatch(/start_date date not null/);
    expectMigrationToMatch(/end_date date not null/);
    expectMigrationToMatch(
      /constraint accounting_periods_date_range_valid check \(start_date <= end_date\)/,
    );
  });

  it("prevents exact duplicate date ranges within an organization only", () => {
    expectMigrationToMatch(
      /constraint accounting_periods_organization_dates_key unique \(organization_id, start_date, end_date\)/,
    );
    expect(normalizedSql).not.toMatch(
      /unique\s*\(\s*start_date\s*,\s*end_date\s*\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*start_date\s*\)/);
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*end_date\s*\)/);
  });

  it("defines the approved period status values and default", () => {
    expectMigrationToMatch(/status text not null default 'open'/);
    expectMigrationToMatch(/constraint accounting_periods_status_valid check/);
    expectMigrationToMatch(/status in \('open', 'closed', 'locked'\)/);
    expect(normalizedSql).not.toContain("pending");
    expect(normalizedSql).not.toContain("archived");
    expect(normalizedSql).not.toContain("inactive");
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(
      /alter table public\.accounting_periods enable row level security/,
    );
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not reference auth users or create overlap-prevention logic", () => {
    expect(normalizedSql).not.toContain("auth.users");
    expect(normalizedSql).not.toMatch(/create function/);
    expect(normalizedSql).not.toMatch(/create trigger/);
    expect(normalizedSql).not.toMatch(/exclude using/);
    expect(normalizedSql).not.toMatch(/tstzrange|daterange/);
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
