import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260726103000_fix_record_expense_alias_collision.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("fix record expense alias collision migration", () => {
  it("1. corrective migration exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_fix_record_expense_alias_collision.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
  });

  it("2. CREATE OR REPLACE FUNCTION used", () => {
    expectMigrationToMatch(/create or replace function public\.record_expense/);
  });

  it("3. exact three-UUID signature preserved", () => {
    expectMigrationToMatch(
      /create or replace function public\.record_expense\( target_organization_id uuid, target_expense_id uuid, input_credit_account_id uuid \)/,
    );
  });

  it("4. returns public.expenses", () => {
    expectMigrationToMatch(/returns public\.expenses/);
  });

  it("5. SECURITY DEFINER preserved", () => {
    expectMigrationToMatch(/security definer/);
  });

  it("6. empty search_path preserved", () => {
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("7. declared record variable is not named expense_line", () => {
    expect(normalizedSql).not.toMatch(/\bexpense_line record\b/);
    expect(normalizedSql).toContain("expense_line_record record");
  });

  it("8. declared record variable is not named fund_bucket", () => {
    expect(normalizedSql).not.toMatch(/\bfund_bucket record\b/);
    expect(normalizedSql).toContain("fund_bucket_record record");
  });

  it("9. SQL alias expense_line is not used", () => {
    expect(normalizedSql).not.toMatch(/\bas expense_line\b/);
    expect(normalizedSql).not.toMatch(/from public\.expense_lines as expense_line/);
  });

  it("10. SQL alias fund_bucket does not collide with a record variable", () => {
    expect(normalizedSql).not.toMatch(/\bas fund_bucket\b/);
    expect(normalizedSql).not.toMatch(/for fund_bucket in/);
    expect(normalizedSql).toContain("for fund_bucket_record in");
  });

  it("11. total query uses an unambiguous alias such as el", () => {
    expect(normalizedSql).toMatch(
      /select count\(\*\), coalesce\(sum\(el\.amount\), 0\) into line_count, line_total from public\.expense_lines el where el\.expense_id = target_expense_id/,
    );
  });

  it("12. sum references the SQL alias amount", () => {
    expect(normalizedSql).toContain("coalesce(sum(el.amount), 0)");
  });

  it("13. expense ID predicate uses the same SQL alias", () => {
    expect(normalizedSql).toContain("where el.expense_id = target_expense_id");
  });

  it("14. debit-account validation remains", () => {
    expect(normalizedSql).toContain("from public.expense_lines el");
    expect(normalizedSql).toContain("inner join public.accounts da");
    expect(normalizedSql).toContain("da.organization_id <> target_organization_id");
    expect(normalizedSql).toContain("da.account_type <> 'expense'");
    expect(normalizedSql).toContain("da.status <> 'active'");
    expect(normalizedSql).toContain("da.is_posting is not true");
    expect(normalizedSql).toContain("raise exception 'invalid expense line account'");
  });

  it("15. fund validation remains", () => {
    expect(normalizedSql).toContain("inner join public.funds lf");
    expect(normalizedSql).toContain("lf.organization_id <> target_organization_id");
    expect(normalizedSql).toContain("lf.status <> 'active'");
    expect(normalizedSql).toContain("raise exception 'invalid expense line fund'");
  });

  it("16. expense line loop remains ordered by line_number", () => {
    expect(normalizedSql).toContain("for expense_line_record in");
    expect(normalizedSql).toContain("order by line_number asc");
  });

  it("17. renamed expense line record is used in loop body", () => {
    expect(normalizedSql).toContain("expense_line_record.account_id");
    expect(normalizedSql).toContain("expense_line_record.fund_id");
    expect(normalizedSql).toContain("expense_line_record.amount");
    expect(normalizedSql).toContain(
      "coalesce(nullif(btrim(expense_line_record.description), ''), current_expense.description)",
    );
  });

  it("18. fund bucket loop remains grouped by fund_id", () => {
    expect(normalizedSql).toContain("for fund_bucket_record in");
    expect(normalizedSql).toContain("group by fb.fund_id");
  });

  it("19. renamed fund bucket record is used in loop body", () => {
    expect(normalizedSql).toContain("fund_bucket_record.fund_id");
    expect(normalizedSql).toContain("fund_bucket_record.bucket_total");
  });

  it("20. full UUID entry-number strategy remains", () => {
    const entryNumberAssignment = normalizedSql.slice(
      normalizedSql.indexOf("generated_entry_number :="),
      normalizedSql.indexOf("insert into public.journal_entries"),
    );

    expect(entryNumberAssignment).toContain(
      "upper(replace(target_expense_id::text, '-', ''))",
    );
    expect(entryNumberAssignment).toContain("'exp-%s'");
  });

  it("21. no substr truncation returns", () => {
    const entryNumberAssignment = normalizedSql.slice(
      normalizedSql.indexOf("generated_entry_number :="),
      normalizedSql.indexOf("insert into public.journal_entries"),
    );

    expect(entryNumberAssignment).not.toContain("substr(");
    expect(entryNumberAssignment).not.toMatch(/,\s*1,\s*12/);
  });

  it("22. expense lock remains FOR UPDATE", () => {
    expect(normalizedSql).toContain("for update");
  });

  it("23. draft status guard remains", () => {
    expect(normalizedSql).toContain("if current_expense.status <> 'draft' then");
    expect(normalizedSql).toContain("raise exception 'expense is not in draft status'");
  });

  it("24. duplicate journal guards remain", () => {
    expect(normalizedSql).toContain("if current_expense.journal_entry_id is not null then");
    expect(normalizedSql).toContain("from public.journal_entries existing_journal");
    expect(normalizedSql).toContain("existing_journal.source_type = 'expense'");
    expect(normalizedSql).toContain("existing_journal.source_id = target_expense_id");
  });

  it("25. period resolution remains", () => {
    expect(normalizedSql).toContain("from public.accounting_periods ap");
    expect(normalizedSql).toContain("if period_count <> 1 then");
    expect(normalizedSql).toContain(
      "raise exception 'accounting period could not be resolved for expense date'",
    );
    expect(normalizedSql).toContain("if matched_period.status = 'closed' then");
    expect(normalizedSql).toContain("if matched_period.status = 'locked' then");
    expect(normalizedSql).toContain("if matched_period.status <> 'open' then");
  });

  it("26. payment-source account rules remain", () => {
    expect(normalizedSql).toContain("case current_expense.payment_source");
    expect(normalizedSql).toContain("when 'bank' then");
    expect(normalizedSql).toContain("when 'cash' then");
    expect(normalizedSql).toContain("when 'card' then");
    expect(normalizedSql).toContain("when 'reimbursement' then");
    expect(normalizedSql).toContain("when 'other' then");
  });

  it("27. journal header remains posted", () => {
    expect(normalizedSql.match(/insert into public\.journal_entries/g)?.length).toBe(1);
    expect(normalizedSql).toContain("'posted'");
    expect(normalizedSql).toContain("source_type");
    expect(normalizedSql).toContain("source_id");
  });

  it("28. debit journal lines remain", () => {
    expect(normalizedSql).toContain("insert into public.journal_entry_lines");
    expect(normalizedSql).toContain("debit_line_number := debit_line_number + 1");
    expect(normalizedSql).toContain("expense_line_record.amount");
  });

  it("29. split credit lines remain", () => {
    expect(normalizedSql).toContain("credit_line_number := credit_line_number + 1");
    expect(normalizedSql).toContain("input_credit_account_id");
    expect(normalizedSql).toContain("order by fb.fund_id nulls last");
  });

  it("30. global balance check remains", () => {
    expect(normalizedSql).toContain("if total_debits <> total_credits then");
    expect(normalizedSql).toContain("raise exception 'journal entry is not balanced'");
    expect(normalizedSql).toContain("if total_debits <> line_total then");
  });

  it("31. per-fund balance check remains", () => {
    expect(normalizedSql).toContain("fund_bucket_balance.bucket_debits");
    expect(normalizedSql).toContain("fund_bucket_balance.bucket_credits");
    expect(normalizedSql).toContain(
      "raise exception 'journal entry fund buckets are not balanced'",
    );
  });

  it("32. expense status becomes recorded", () => {
    expect(normalizedSql).toContain("status = 'recorded'");
  });

  it("33. journal_entry_id is set", () => {
    expect(normalizedSql).toContain("journal_entry_id = created_journal_entry_id");
  });

  it("34. one expense.recorded audit insertion remains", () => {
    expect(normalizedSql.match(/insert into public\.audit_events/g)?.length).toBe(1);
    expect(normalizedSql).toContain("'expense.recorded'");
    expect(normalizedSql).toContain("auth.uid()");
  });

  it("35. function return remains", () => {
    expect(normalizedSql).toContain("return updated_expense");
    expect(normalizedSql).toContain("returning *");
  });

  it("36. PUBLIC revoked", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.record_expense(uuid, uuid, uuid) from public",
    );
  });

  it("37. anon revoked", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.record_expense(uuid, uuid, uuid) from anon",
    );
  });

  it("38. authenticated granted", () => {
    expect(migrationSql).toContain(
      "grant execute on function public.record_expense(uuid, uuid, uuid) to authenticated",
    );
  });

  it("39. no RLS policies added", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("40. no unrelated schema changes", () => {
    expect(normalizedSql).not.toMatch(/\balter table\b/);
    expect(normalizedSql).not.toMatch(/\bcreate table\b/);
    expect(normalizedSql).not.toMatch(/\bdrop table\b/);
    expect(normalizedSql).not.toMatch(/\bdrop column\b/);
    expect(normalizedSql).not.toMatch(/\bcreate index\b/);
    expect(normalizedSql).not.toMatch(/\bdrop index\b/);
    expect(normalizedSql).not.toMatch(/\btruncate\b/);
    expect(normalizedSql).not.toMatch(/\bdelete from\b/);
  });
});
