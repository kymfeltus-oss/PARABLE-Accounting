import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260803103000_banking_basics_rpcs.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("banking basics RPC migration", () => {
  it("creates create_bank_account with the expected signature", () => {
    expectMigrationToMatch(
      /create or replace function public\.create_bank_account\( target_organization_id uuid, input_name text, input_account_id uuid, input_institution_name text default null, input_account_type text default 'checking', input_last_four text default null \)/,
    );
    expectMigrationToMatch(/returns public\.bank_accounts/);
  });

  it("creates create_bank_transaction with signed amount semantics", () => {
    expectMigrationToMatch(
      /create or replace function public\.create_bank_transaction\( target_organization_id uuid, input_bank_account_id uuid, input_transaction_date date, input_amount numeric, input_description text default null, input_transaction_type text default null \)/,
    );
    expectMigrationToMatch(/returns public\.bank_transactions/);
    expect(normalizedSql).toContain("signed_amount := abs(input_amount)");
    expect(normalizedSql).toContain("signed_amount := -abs(input_amount)");
    expect(normalizedSql).toContain("'unmatched'");
  });

  it("creates match_bank_transaction with confirmed match and status update", () => {
    expectMigrationToMatch(
      /create or replace function public\.match_bank_transaction\( target_organization_id uuid, input_bank_transaction_id uuid, input_match_type text, input_matched_source_id uuid \)/,
    );
    expectMigrationToMatch(/returns public\.bank_transaction_matches/);
    expect(normalizedSql).toContain("'confirmed'");
    expect(normalizedSql).toContain("status = 'matched'");
  });

  it("uses plpgsql, SECURITY DEFINER, and an empty search_path", () => {
    expectMigrationToMatch(/language plpgsql/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("allows staff+ via has_org_role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("validates posting asset chart accounts for bank account creation", () => {
    expect(normalizedSql).toContain("matched_account.is_posting is not true");
    expect(normalizedSql).toContain("matched_account.account_type <> 'asset'");
  });

  it("appends audit events for each write path", () => {
    expect(normalizedSql).toContain("'bank_account.created'");
    expect(normalizedSql).toContain("'bank_transaction.created'");
    expect(normalizedSql).toContain("'bank_transaction.matched'");
    expect(normalizedSql.match(/insert into public\.audit_events/g)?.length).toBe(3);
  });

  it("hardens execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.create_bank_account(uuid, text, uuid, text, text, text) from public",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.match_bank_transaction(uuid, uuid, text, uuid) to authenticated",
    );
  });
});
