import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const journalEntryLinesMigrationFiles = readdirSync(migrationsDirectory).filter(
  (file) => file.endsWith("_create_journal_entry_lines.sql"),
);
const migrationSql =
  journalEntryLinesMigrationFiles.length === 1
    ? readFileSync(
        join(migrationsDirectory, journalEntryLinesMigrationFiles[0]),
        "utf8",
      )
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("journal entry lines migration", () => {
  it("has exactly one create_journal_entry_lines migration file", () => {
    expect(journalEntryLinesMigrationFiles).toHaveLength(1);
  });

  it("creates public.journal_entry_lines with the required id primary key", () => {
    expectMigrationToMatch(/create table public\.journal_entry_lines/);
    expectMigrationToMatch(/id uuid primary key default gen_random_uuid\(\)/);
  });

  it("requires a journal entry id with a cascading journal entries foreign key", () => {
    expectMigrationToMatch(/journal_entry_id uuid not null/);
    expectMigrationToMatch(
      /constraint journal_entry_lines_journal_entry_id_fkey foreign key \(journal_entry_id\) references public\.journal_entries\(id\) on delete cascade/,
    );
  });

  it("requires an account id with restricted account deletion", () => {
    expectMigrationToMatch(/account_id uuid not null/);
    expectMigrationToMatch(
      /constraint journal_entry_lines_account_id_fkey foreign key \(account_id\) references public\.accounts\(id\) on delete restrict/,
    );
    expect(normalizedSql).not.toMatch(
      /foreign key \(account_id\) references public\.accounts\(id\) on delete cascade/,
    );
  });

  it("allows an optional fund id with restricted fund deletion", () => {
    expectMigrationToMatch(/fund_id uuid[, ]/);
    expect(normalizedSql).not.toMatch(/fund_id uuid not null/);
    expectMigrationToMatch(
      /constraint journal_entry_lines_fund_id_fkey foreign key \(fund_id\) references public\.funds\(id\) on delete restrict/,
    );
  });

  it("requires positive line numbers unique within a journal entry only", () => {
    expectMigrationToMatch(/line_number integer not null/);
    expectMigrationToMatch(
      /constraint journal_entry_lines_line_number_positive check \(line_number > 0\)/,
    );
    expectMigrationToMatch(
      /constraint journal_entry_lines_journal_line_key unique \(journal_entry_id, line_number\)/,
    );
    expect(normalizedSql).not.toMatch(/unique\s*\(\s*line_number\s*\)/);
  });

  it("allows nullable line descriptions", () => {
    expectMigrationToMatch(/description text[, ]/);
    expect(normalizedSql).not.toMatch(/description text not null/);
  });

  it("defines debit and credit amounts with fixed precision numeric defaults", () => {
    expectMigrationToMatch(/debit_amount numeric\(18,2\) not null default 0/);
    expectMigrationToMatch(/credit_amount numeric\(18,2\) not null default 0/);
    expect(normalizedSql).not.toMatch(/\breal\b/);
    expect(normalizedSql).not.toMatch(/double precision/);
  });

  it("prevents negative debit and credit amounts", () => {
    expectMigrationToMatch(
      /constraint journal_entry_lines_debit_nonnegative check \(debit_amount >= 0\)/,
    );
    expectMigrationToMatch(
      /constraint journal_entry_lines_credit_nonnegative check \(credit_amount >= 0\)/,
    );
  });

  it("requires each line to contain exactly one positive debit or credit amount", () => {
    expectMigrationToMatch(/constraint journal_entry_lines_one_sided_amount check/);
    expectMigrationToMatch(/debit_amount > 0 and credit_amount = 0/);
    expectMigrationToMatch(/credit_amount > 0 and debit_amount = 0/);
    expectMigrationToMatch(/or/);
  });

  it("does not duplicate organization ownership on line rows", () => {
    expect(normalizedSql).not.toMatch(/\borganization_id\b/);
  });

  it("does not create journal-level balancing or posting logic", () => {
    expect(normalizedSql).not.toMatch(/create function/);
    expect(normalizedSql).not.toMatch(/create trigger/);
    expect(normalizedSql).not.toMatch(/deferred/);
    expect(normalizedSql).not.toMatch(/posting/);
  });

  it("defines required timestamp columns with now defaults", () => {
    expectMigrationToMatch(/created_at timestamptz not null default now\(\)/);
    expectMigrationToMatch(/updated_at timestamptz not null default now\(\)/);
  });

  it("enables row level security without creating policies", () => {
    expectMigrationToMatch(
      /alter table public\.journal_entry_lines enable row level security/,
    );
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("does not reference auth users or create unrelated domain tables", () => {
    const futureDomainTables = [
      "transactions",
      "members",
      "giving",
      "vendors",
      "expenses",
      "bills",
      "budgets",
      "bank_accounts",
    ];

    expect(normalizedSql).not.toContain("auth.users");

    for (const tableName of futureDomainTables) {
      expect(normalizedSql).not.toMatch(
        new RegExp(`create\\s+table\\s+(public\\.)?${tableName}\\b`),
      );
    }
  });
});
