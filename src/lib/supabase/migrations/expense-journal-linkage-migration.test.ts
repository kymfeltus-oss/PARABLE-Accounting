import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260724103000_add_expense_journal_linkage.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("expense journal linkage migration", () => {
  it("1. migration file exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_add_expense_journal_linkage.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
    expect(migrationPath).toContain(migrationFilename);
  });

  it("2. adds source_id to public.journal_entries", () => {
    expectMigrationToMatch(
      /alter table public\.journal_entries add column source_id uuid null/,
    );
  });

  it("3. source_id type is uuid", () => {
    expectMigrationToMatch(/source_id uuid null/);
  });

  it("4. source_id is nullable", () => {
    expectMigrationToMatch(/add column source_id uuid null/);
    expect(normalizedSql).not.toMatch(/source_id uuid not null/);
  });

  it("5. has no default on source_id", () => {
    expect(normalizedSql).not.toMatch(/source_id uuid null default/);
    expect(normalizedSql).not.toMatch(/source_id uuid default/);
  });

  it("6. adds journal_entry_id to public.expenses", () => {
    expectMigrationToMatch(
      /alter table public\.expenses add column journal_entry_id uuid null/,
    );
  });

  it("7. journal_entry_id type is uuid", () => {
    expectMigrationToMatch(/journal_entry_id uuid null/);
  });

  it("8. journal_entry_id is nullable", () => {
    expectMigrationToMatch(/add column journal_entry_id uuid null/);
    expect(normalizedSql).not.toMatch(/journal_entry_id uuid not null/);
  });

  it("9. has no default on journal_entry_id", () => {
    expect(normalizedSql).not.toMatch(/journal_entry_id uuid null default/);
    expect(normalizedSql).not.toMatch(/journal_entry_id uuid default/);
  });

  it("10. foreign key points to public.journal_entries(id)", () => {
    expect(normalizedSql).toContain("constraint expenses_journal_entry_id_fkey");
    expectMigrationToMatch(
      /foreign key \(journal_entry_id\) references public\.journal_entries\(id\)/,
    );
  });

  it("11. foreign key uses ON DELETE RESTRICT", () => {
    expectMigrationToMatch(
      /foreign key \(journal_entry_id\) references public\.journal_entries\(id\) on delete restrict/,
    );
  });

  it("12. partial unique index exists", () => {
    expectMigrationToMatch(
      /create unique index journal_entries_expense_source_unique/,
    );
  });

  it("13. partial unique index includes organization_id", () => {
    expectMigrationToMatch(
      /create unique index journal_entries_expense_source_unique on public\.journal_entries \( organization_id, source_id \)/,
    );
  });

  it("14. partial unique index includes source_id", () => {
    expectMigrationToMatch(
      /journal_entries_expense_source_unique on public\.journal_entries \( organization_id, source_id \)/,
    );
  });

  it("15. partial predicate requires source_type = 'expense'", () => {
    expectMigrationToMatch(
      /where source_type = 'expense'/,
    );
  });

  it("16. partial predicate requires source_id IS NOT NULL", () => {
    expectMigrationToMatch(/and source_id is not null/);
  });

  it("17. general source lookup index exists", () => {
    expectMigrationToMatch(/create index journal_entries_source_lookup/);
  });

  it("18. source lookup index includes organization_id", () => {
    expectMigrationToMatch(
      /create index journal_entries_source_lookup on public\.journal_entries \( organization_id, source_type, source_id \)/,
    );
  });

  it("19. source lookup index includes source_type", () => {
    expectMigrationToMatch(
      /journal_entries_source_lookup on public\.journal_entries \( organization_id, source_type, source_id \)/,
    );
  });

  it("20. source lookup index includes source_id", () => {
    expectMigrationToMatch(
      /journal_entries_source_lookup on public\.journal_entries \( organization_id, source_type, source_id \)/,
    );
  });

  it("21. expenses journal_entry_id lookup index exists", () => {
    expectMigrationToMatch(
      /create index expenses_journal_entry_id_idx on public\.expenses \( ?journal_entry_id ?\)/,
    );
  });

  it("22. does not backfill existing rows", () => {
    expect(normalizedSql).not.toMatch(/\bupdate public\.(expenses|journal_entries)\b/);
    expect(normalizedSql).not.toMatch(/\bset source_id\b/);
    expect(normalizedSql).not.toMatch(/\bset journal_entry_id\b/);
  });

  it("23. does not insert journal entries", () => {
    expect(normalizedSql).not.toMatch(/\binsert into public\.journal_entries\b/);
  });

  it("24. does not update expense rows", () => {
    expect(normalizedSql).not.toMatch(/\bupdate public\.expenses\b/);
  });

  it("25. does not change status values", () => {
    expect(normalizedSql).not.toMatch(/\bset status\b/);
    expect(normalizedSql).not.toMatch(/alter table public\.expenses.*status/);
    expect(normalizedSql).not.toMatch(/alter table public\.journal_entries.*status/);
  });

  it("26. does not create record_expense function", () => {
    expect(normalizedSql).not.toMatch(/create or replace function public\.record_expense/);
    expect(normalizedSql).not.toMatch(/create function public\.record_expense/);
  });

  it("27. does not create posting function", () => {
    expect(normalizedSql).not.toMatch(/create or replace function public\./);
    expect(normalizedSql).not.toMatch(/create function public\./);
  });

  it("28. does not insert audit events", () => {
    expect(normalizedSql).not.toMatch(/\binsert into public\.audit_events\b/);
  });

  it("29. does not add posted_at column", () => {
    expect(normalizedSql).not.toContain("posted_at");
  });

  it("30. does not add reversal column", () => {
    expect(normalizedSql).not.toContain("reversal_of_journal_entry_id");
    expect(normalizedSql).not.toContain("reversal");
  });

  it("31. does not add payment account column", () => {
    expect(normalizedSql).not.toContain("payment_account_id");
  });

  it("32. does not add bank account column", () => {
    expect(normalizedSql).not.toContain("bank_account_id");
  });

  it("33. does not add direct journal write RLS policy", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("34. does not add direct expense write RLS policy", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("35. does not add broad grants", () => {
    expect(normalizedSql).not.toMatch(/\bgrant\b/);
    expect(normalizedSql).not.toMatch(/\brevoke\b/);
  });

  it("36. source_id comment exists", () => {
    expect(migrationSql).toContain(
      "comment on column public.journal_entries.source_id is",
    );
    expect(migrationSql.toLowerCase()).toContain("polymorphic source-document identifier");
    expect(migrationSql.toLowerCase()).toContain("paired with source_type");
  });

  it("37. journal_entry_id comment exists", () => {
    expect(migrationSql).toContain(
      "comment on column public.expenses.journal_entry_id is",
    );
    expect(migrationSql).toContain("Posted journal entry generated when the expense is recorded");
  });

  it("38. duplicate-posting index documentation exists", () => {
    expect(migrationSql).toContain(
      "comment on index public.journal_entries_expense_source_unique is",
    );
    expect(migrationSql).toContain(
      "Prevents more than one expense-sourced journal per organization and source document",
    );
  });

  it("39. migration is additive", () => {
    expectMigrationToMatch(/alter table public\.journal_entries add column source_id/);
    expectMigrationToMatch(/alter table public\.expenses add column journal_entry_id/);
    expectMigrationToMatch(/create unique index journal_entries_expense_source_unique/);
    expectMigrationToMatch(/create index journal_entries_source_lookup/);
    expectMigrationToMatch(/create index expenses_journal_entry_id_idx/);
  });

  it("40. contains no destructive DROP or DELETE statements", () => {
    expect(normalizedSql).not.toMatch(/\bdrop table\b/);
    expect(normalizedSql).not.toMatch(/\bdrop column\b/);
    expect(normalizedSql).not.toMatch(/\bdrop index\b/);
    expect(normalizedSql).not.toMatch(/\bdrop constraint\b/);
    expect(normalizedSql).not.toMatch(/\bdelete from\b/);
    expect(normalizedSql).not.toMatch(/\btruncate\b/);
  });
});
