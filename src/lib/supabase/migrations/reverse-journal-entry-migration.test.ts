import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260728103000_reverse_journal_entry.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("reverse journal entry RPC migration", () => {
  it("migration file exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_reverse_journal_entry.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
  });

  it("adds reversal source type and linkage columns", () => {
    expect(normalizedSql).toContain("'reversal'");
    expect(normalizedSql).toContain("add column reverses_journal_entry_id uuid null");
    expect(normalizedSql).toContain("add column reversal_reason text null");
    expect(normalizedSql).toContain(
      "create unique index journal_entries_one_reversal_per_original_uidx",
    );
  });

  it("creates reverse_journal_entry with the expected signature", () => {
    expectMigrationToMatch(
      /create or replace function public\.reverse_journal_entry\( target_organization_id uuid, target_journal_entry_id uuid, input_reversal_date date, input_period_id uuid, input_reason text \)/,
    );
    expectMigrationToMatch(/returns public\.journal_entries/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("hardens execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) to authenticated",
    );
  });

  it("requires authentication and staff+ role", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain(
      "raise exception 'authenticated user is required'",
    );
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
    expect(normalizedSql).toContain(
      "raise exception 'insufficient role to reverse journal entry'",
    );
  });

  it("locks the original journal and enforces posted/manual-or-adjustment eligibility", () => {
    expectMigrationToMatch(
      /from public\.journal_entries journal_row where journal_row\.id = target_journal_entry_id for update/,
    );
    expect(normalizedSql).toContain(
      "raise exception 'only posted journal entries can be reversed'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'journal entry has already been reversed'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'reversal journal cannot be reversed'",
    );
    expect(normalizedSql).toContain(
      "original_journal.source_type not in ('manual', 'adjustment')",
    );
  });

  it("swaps debit and credit amounts when inserting reversal lines", () => {
    expectMigrationToMatch(
      /insert into public\.journal_entry_lines \( journal_entry_id, account_id, fund_id, line_number, description, debit_amount, credit_amount \) select created_reversal_id, line_row\.account_id, line_row\.fund_id, line_row\.line_number, line_row\.description, line_row\.credit_amount, line_row\.debit_amount from public\.journal_entry_lines line_row where line_row\.journal_entry_id = original_journal\.id/,
    );
    expect(normalizedSql).toContain("source_type, source_id, status, reverses_journal_entry_id, reversal_reason");
    expect(normalizedSql).toContain("'reversal'");
    expect(normalizedSql).toContain("status = 'reversed'");
  });

  it("writes one journal.reversed audit event", () => {
    expect(normalizedSql).toContain("'journal.reversed'");
    expect(normalizedSql).toContain("actor_user_id");
    expect(normalizedSql).toContain("auth.uid()");
  });

  it("scopes the original and selected period to the target organization", () => {
    expect(normalizedSql).toContain(
      "if original_journal.organization_id <> target_organization_id then",
    );
    expect(normalizedSql).toContain(
      "if matched_period.organization_id <> target_organization_id then",
    );
    expect(normalizedSql).toContain(
      "if matched_period.status <> 'open' then",
    );
    expectMigrationToMatch(
      /if input_reversal_date < matched_period\.start_date or input_reversal_date > matched_period\.end_date then/,
    );
  });

  it("validates a balanced nonzero original before inserting the reversal", () => {
    expect(normalizedSql).toContain("if line_count < 2 then");
    expect(normalizedSql).toContain(
      "if total_debits <> total_credits then",
    );
    expect(normalizedSql).toContain("if total_debits <= 0 then");
  });

  it("creates header, swapped lines, original status, and audit in one RPC body", () => {
    const headerPosition = normalizedSql.indexOf(
      "insert into public.journal_entries",
    );
    const linesPosition = normalizedSql.indexOf(
      "insert into public.journal_entry_lines",
    );
    const statusPosition = normalizedSql.indexOf(
      "update public.journal_entries",
    );
    const auditPosition = normalizedSql.indexOf(
      "insert into public.audit_events",
    );

    expect(headerPosition).toBeGreaterThan(-1);
    expect(linesPosition).toBeGreaterThan(headerPosition);
    expect(statusPosition).toBeGreaterThan(linesPosition);
    expect(auditPosition).toBeGreaterThan(statusPosition);
  });

  it("maps unique violations to already-reversed", () => {
    expect(normalizedSql).toContain("when unique_violation then");
    expect(normalizedSql).toContain(
      "raise exception 'journal entry has already been reversed'",
    );
  });

  it("does not accept browser-supplied reversal lines", () => {
    expect(normalizedSql).not.toContain("input_lines");
  });
});
