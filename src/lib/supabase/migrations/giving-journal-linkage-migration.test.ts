import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260729103000_add_giving_journal_linkage.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("giving journal linkage migration", () => {
  it("1. migration file exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_add_giving_journal_linkage.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
    expect(migrationPath).toContain(migrationFilename);
  });

  it("2. adds journal_entry_id to public.giving_transactions", () => {
    expectMigrationToMatch(
      /alter table public\.giving_transactions add column journal_entry_id uuid null/,
    );
  });

  it("3. journal_entry_id type is uuid", () => {
    expectMigrationToMatch(/journal_entry_id uuid null/);
  });

  it("4. journal_entry_id is nullable", () => {
    expectMigrationToMatch(/add column journal_entry_id uuid null/);
    expect(normalizedSql).not.toMatch(/journal_entry_id uuid not null/);
  });

  it("5. has no default on journal_entry_id", () => {
    expect(normalizedSql).not.toMatch(/journal_entry_id uuid null default/);
    expect(normalizedSql).not.toMatch(/journal_entry_id uuid default/);
  });

  it("6. foreign key points to public.journal_entries(id)", () => {
    expect(normalizedSql).toContain(
      "constraint giving_transactions_journal_entry_id_fkey",
    );
    expectMigrationToMatch(
      /foreign key \(journal_entry_id\) references public\.journal_entries\(id\)/,
    );
  });

  it("7. foreign key uses ON DELETE RESTRICT", () => {
    expectMigrationToMatch(
      /foreign key \(journal_entry_id\) references public\.journal_entries\(id\) on delete restrict/,
    );
  });

  it("8. partial unique index exists", () => {
    expectMigrationToMatch(
      /create unique index journal_entries_giving_source_unique/,
    );
  });

  it("9. partial unique index includes organization_id", () => {
    expectMigrationToMatch(
      /create unique index journal_entries_giving_source_unique on public\.journal_entries \( organization_id, source_id \)/,
    );
  });

  it("10. partial unique index includes source_id", () => {
    expectMigrationToMatch(
      /journal_entries_giving_source_unique on public\.journal_entries \( organization_id, source_id \)/,
    );
  });

  it("11. partial predicate requires source_type = 'giving'", () => {
    expectMigrationToMatch(/where source_type = 'giving'/);
  });

  it("12. partial predicate requires source_id IS NOT NULL", () => {
    expectMigrationToMatch(/and source_id is not null/);
  });

  it("13. giving journal_entry_id lookup index exists", () => {
    expectMigrationToMatch(
      /create index giving_transactions_journal_entry_id_idx on public\.giving_transactions \( ?journal_entry_id ?\)/,
    );
  });

  it("14. does not backfill existing rows", () => {
    expect(normalizedSql).not.toMatch(
      /\bupdate public\.(giving_transactions|journal_entries)\b/,
    );
    expect(normalizedSql).not.toMatch(/\bset source_id\b/);
    expect(normalizedSql).not.toMatch(/\bset journal_entry_id\b/);
  });

  it("15. does not insert journal entries", () => {
    expect(normalizedSql).not.toMatch(/\binsert into public\.journal_entries\b/);
  });

  it("16. does not create record_giving function", () => {
    expect(normalizedSql).not.toMatch(
      /create or replace function public\.record_giving/,
    );
    expect(normalizedSql).not.toMatch(/create function public\.record_giving/);
  });

  it("17. does not insert audit events", () => {
    expect(normalizedSql).not.toMatch(/\binsert into public\.audit_events\b/);
  });

  it("18. does not add direct write RLS policy", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("19. does not add broad grants", () => {
    expect(normalizedSql).not.toMatch(/\bgrant\b/);
    expect(normalizedSql).not.toMatch(/\brevoke\b/);
  });

  it("20. journal_entry_id comment exists", () => {
    expect(migrationSql).toContain(
      "comment on column public.giving_transactions.journal_entry_id is",
    );
    expect(migrationSql).toContain(
      "Posted journal entry generated when the giving transaction is recorded",
    );
  });

  it("21. duplicate-posting index documentation exists", () => {
    expect(migrationSql).toContain(
      "comment on index public.journal_entries_giving_source_unique is",
    );
    expect(migrationSql).toContain(
      "Prevents more than one giving-sourced journal per organization and source document",
    );
  });

  it("22. migration is additive", () => {
    expectMigrationToMatch(
      /alter table public\.giving_transactions add column journal_entry_id/,
    );
    expectMigrationToMatch(/create unique index journal_entries_giving_source_unique/);
    expectMigrationToMatch(
      /create index giving_transactions_journal_entry_id_idx/,
    );
  });

  it("23. contains no destructive DROP or DELETE statements", () => {
    expect(normalizedSql).not.toMatch(/\bdrop table\b/);
    expect(normalizedSql).not.toMatch(/\bdrop column\b/);
    expect(normalizedSql).not.toMatch(/\bdrop index\b/);
    expect(normalizedSql).not.toMatch(/\bdrop constraint\b/);
    expect(normalizedSql).not.toMatch(/\bdelete from\b/);
    expect(normalizedSql).not.toMatch(/\btruncate\b/);
  });
});
