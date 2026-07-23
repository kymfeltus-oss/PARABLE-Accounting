import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260722103000_create_expense_draft.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("create expense draft RPC migration", () => {
  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain("20260722103000_create_expense_draft.sql");
  });

  it("creates create_expense_draft with the expected signature", () => {
    expectMigrationToMatch(
      /create or replace function public\.create_expense_draft\( target_organization_id uuid, input_expense_date date, input_description text, input_total_amount numeric, input_vendor_id uuid default null, input_reference text default null, input_payment_source text default 'other' \)/,
    );
    expectMigrationToMatch(/returns public\.expenses/);
  });

  it("uses plpgsql, SECURITY DEFINER, and an empty search_path", () => {
    expectMigrationToMatch(/language plpgsql/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("rejects unauthenticated callers via auth.uid() guard", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain("raise exception 'authenticated user is required'");
  });

  it("allows owner via has_org_role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
    expect(normalizedSql).toContain("'owner'");
  });

  it("allows accountant via has_org_role", () => {
    expect(normalizedSql).toContain("'accountant'");
  });

  it("allows staff via has_org_role", () => {
    expect(normalizedSql).toContain("'staff'");
  });

  it("excludes viewer from allowed roles", () => {
    expect(normalizedSql).not.toMatch(
      /array\['owner', 'accountant', 'staff', 'viewer'\]/,
    );
    expect(normalizedSql).not.toMatch(/array\['viewer'\]/);
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("requires an existing organization scoped to target_organization_id", () => {
    expect(normalizedSql).toContain("if target_organization_id is null then");
    expect(normalizedSql).toContain("raise exception 'organization is required'");
    expect(normalizedSql).toContain("from public.organizations organization");
    expect(normalizedSql).toContain("where organization.id = target_organization_id");
    expect(normalizedSql).toContain("raise exception 'organization not found'");
  });

  it("validates description is trimmed and nonblank", () => {
    expect(normalizedSql).toContain("normalized_description := btrim(input_description)");
    expect(normalizedSql).toContain("if normalized_description = '' then");
    expect(normalizedSql).toContain("raise exception 'expense description is required'");
  });

  it("validates total_amount is greater than zero", () => {
    expect(normalizedSql).toContain(
      "if input_total_amount is null or input_total_amount <= 0 then",
    );
    expect(normalizedSql).toContain(
      "raise exception 'total amount must be greater than zero'",
    );
  });

  it("validates payment_source against the exact approved list", () => {
    expect(normalizedSql).toContain("normalized_payment_source := btrim(input_payment_source)");
    expect(normalizedSql).toContain(
      "if normalized_payment_source not in ( 'bank', 'card', 'cash', 'reimbursement', 'other' ) then",
    );
    expect(normalizedSql).toContain("raise exception 'invalid payment source'");
  });

  it("trims optional reference and rejects blank provided values", () => {
    expect(normalizedSql).toContain(
      "if input_reference is not null and btrim(input_reference) = '' then",
    );
    expect(normalizedSql).toContain("raise exception 'expense reference cannot be blank'");
    expect(normalizedSql).toContain(
      "normalized_reference := nullif(btrim(input_reference), '')",
    );
  });

  it("validates vendor existence when vendor_id is provided", () => {
    expect(normalizedSql).toContain("if input_vendor_id is not null then");
    expect(normalizedSql).toContain("from public.vendors");
    expect(normalizedSql).toContain("where id = input_vendor_id");
    expect(normalizedSql).toContain("raise exception 'vendor not found'");
  });

  it("rejects vendors that do not belong to target_organization_id", () => {
    expect(normalizedSql).toContain(
      "if matched_vendor.organization_id <> target_organization_id then",
    );
    expect(normalizedSql).toContain(
      "raise exception 'vendor does not belong to organization'",
    );
  });

  it("forces draft status on insert and does not accept status as input", () => {
    expectMigrationToMatch(
      /insert into public\.expenses \( organization_id, vendor_id, expense_date, description, total_amount, reference, payment_source, status \) values \( target_organization_id, input_vendor_id, input_expense_date, normalized_description, input_total_amount, normalized_reference, normalized_payment_source, 'draft' \)/,
    );
    expect(normalizedSql).not.toMatch(
      /create or replace function public\.create_expense_draft\([\s\S]*\bstatus text/,
    );
    expect(normalizedSql).not.toMatch(/status = input_/);
  });

  it("does not insert expense lines", () => {
    expect(normalizedSql).not.toContain("insert into public.expense_lines");
  });

  it("does not insert journal entries", () => {
    expect(normalizedSql).not.toContain("insert into public.journal_entries");
    expect(normalizedSql).not.toContain("insert into public.journal_entry_lines");
  });

  it("appends an expense created audit event atomically with actor_user_id", () => {
    expect(normalizedSql).toContain("insert into public.audit_events");
    expect(normalizedSql).toContain("'expense.created'");
    expect(normalizedSql).toContain("'expense'");
    expect(normalizedSql).toContain("created_expense.id");
    expect(normalizedSql).toContain("'user'");
    expect(normalizedSql).toContain("actor_user_id");
    expect(normalizedSql).toContain("auth.uid()");
    expect(migrationSql).toContain('Draft expense "%s" created');
    expect(migrationSql).toContain("normalized_description");
    expect(normalizedSql).not.toContain("'expense.recorded'");
    expect(normalizedSql).not.toContain("'expense.posted'");
    expect(normalizedSql).not.toContain("'expense.approved'");
    expect(normalizedSql).not.toContain("'expense.paid'");
  });

  it("returns the newly created expense row", () => {
    expect(normalizedSql).toContain("returning * into created_expense");
    expect(normalizedSql).toContain("return created_expense");
  });

  it("does not add broad expenses write RLS policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/for update to authenticated/);
    expect(normalizedSql).not.toMatch(/for insert to authenticated/);
    expect(normalizedSql).not.toMatch(/for delete to authenticated/);
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.expenses/,
    );
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.audit_events/,
    );
  });

  it("revokes PUBLIC and anon and grants authenticated execute", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.create_expense_draft\(uuid, date, text, numeric, uuid, text, text\) to anon/,
    );
  });

  it("documents the narrow draft-header scope in the function comment", () => {
    expect(migrationSql).toContain(
      "comment on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text)",
    );
    expect(migrationSql.toLowerCase()).toContain("draft expense header");
    expect(migrationSql.toLowerCase()).toContain("line allocation");
    expect(migrationSql.toLowerCase()).toContain("recording");
    expect(migrationSql.toLowerCase()).toContain("journal posting");
    expect(migrationSql.toLowerCase()).toContain("voiding");
    expect(migrationSql.toLowerCase()).toContain("separate workflows");
  });
});
