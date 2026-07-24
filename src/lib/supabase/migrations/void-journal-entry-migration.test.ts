import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260730103000_void_journal_entry.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("void journal entry RPC migration", () => {
  it("migration file exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_void_journal_entry.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
  });

  it("extends status constraint with void and adds void_reason", () => {
    expect(normalizedSql).toContain("'void'");
    expect(normalizedSql).not.toContain("'voided'");
    expect(normalizedSql).toContain("add column void_reason text null");
    expect(normalizedSql).toContain("journal_entries_void_fields_consistent");
    expectMigrationToMatch(
      /status in \( 'draft', 'posted', 'reversed', 'void' \)/,
    );
  });

  it("creates void_journal_entry with the expected signature", () => {
    expectMigrationToMatch(
      /create or replace function public\.void_journal_entry\( target_organization_id uuid, target_journal_entry_id uuid, input_reason text \)/,
    );
    expectMigrationToMatch(/returns public\.journal_entries/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
    expect(normalizedSql).not.toContain("input_reversal_date");
    expect(normalizedSql).not.toContain("input_period_id");
  });

  it("hardens execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.void_journal_entry(uuid, uuid, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.void_journal_entry(uuid, uuid, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.void_journal_entry(uuid, uuid, text) to authenticated",
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
      "raise exception 'insufficient role to void journal entry'",
    );
  });

  it("locks the original journal and enforces eligibility", () => {
    expectMigrationToMatch(
      /from public\.journal_entries journal_row where journal_row\.id = target_journal_entry_id for update/,
    );
    expect(normalizedSql).toContain(
      "raise exception 'only posted journal entries can be voided'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'journal entry has already been voided'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'journal entry has already been reversed'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'reversal journal cannot be voided'",
    );
    expect(normalizedSql).toContain(
      "original_journal.source_type not in ('manual', 'adjustment')",
    );
    expect(normalizedSql).toContain(
      "raise exception 'journal entry does not belong to organization'",
    );
  });

  it("persists void status and void_reason without creating a reversal journal", () => {
    expect(normalizedSql).toContain("status = 'void'");
    expect(normalizedSql).toContain("void_reason = trimmed_reason");
    expect(normalizedSql).not.toContain("insert into public.journal_entries");
    expect(normalizedSql).not.toContain("insert into public.journal_entry_lines");
  });

  it("writes one journal.voided audit event", () => {
    expect(normalizedSql).toContain("'journal.voided'");
    expect(normalizedSql).toContain("actor_user_id");
    expect(normalizedSql).toContain("auth.uid()");
  });

  it("updates status then writes audit in one RPC body", () => {
    const statusPosition = normalizedSql.indexOf(
      "update public.journal_entries",
    );
    const auditPosition = normalizedSql.indexOf(
      "insert into public.audit_events",
    );

    expect(statusPosition).toBeGreaterThan(-1);
    expect(auditPosition).toBeGreaterThan(statusPosition);
  });
});
