import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260725103000_record_expense.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("record expense RPC migration", () => {
  it("1. migration file exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_record_expense.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
  });

  it("2. exact function name exists", () => {
    expectMigrationToMatch(/create or replace function public\.record_expense/);
  });

  it("3. exact three-UUID signature exists", () => {
    expectMigrationToMatch(
      /create or replace function public\.record_expense\( target_organization_id uuid, target_expense_id uuid, input_credit_account_id uuid \)/,
    );
  });

  it("4. returns public.expenses", () => {
    expectMigrationToMatch(/returns public\.expenses/);
  });

  it("5. language plpgsql", () => {
    expectMigrationToMatch(/language plpgsql/);
  });

  it("6. SECURITY DEFINER", () => {
    expectMigrationToMatch(/security definer/);
  });

  it("7. empty search_path", () => {
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("8. PUBLIC execute revoked", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.record_expense(uuid, uuid, uuid) from public",
    );
  });

  it("9. anon execute revoked", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.record_expense(uuid, uuid, uuid) from anon",
    );
  });

  it("10. authenticated execute granted", () => {
    expect(migrationSql).toContain(
      "grant execute on function public.record_expense(uuid, uuid, uuid) to authenticated",
    );
  });

  it("11. auth.uid required", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain("raise exception 'authenticated user is required'");
  });

  it("12. owner allowed", () => {
    expect(normalizedSql).toContain("'owner'");
  });

  it("13. accountant allowed", () => {
    expect(normalizedSql).toContain("'accountant'");
  });

  it("14. staff allowed", () => {
    expect(normalizedSql).toContain("'staff'");
  });

  it("15. viewer denied", () => {
    expect(normalizedSql).not.toMatch(
      /array\['owner', 'accountant', 'staff', 'viewer'\]/,
    );
    expect(normalizedSql).not.toMatch(/array\['viewer'\]/);
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("16. organization role helper used", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
  });

  it("17. expense scoped by ID and organization", () => {
    expect(normalizedSql).toContain("where id = target_expense_id");
    expect(normalizedSql).toContain("and organization_id = target_organization_id");
  });

  it("18. expense locked FOR UPDATE", () => {
    expect(normalizedSql).toContain("for update");
  });

  it("19. draft status required", () => {
    expect(normalizedSql).toContain("if current_expense.status <> 'draft' then");
    expect(normalizedSql).toContain("raise exception 'expense is not in draft status'");
  });

  it("20. non-null journal_entry_id rejected", () => {
    expect(normalizedSql).toContain("if current_expense.journal_entry_id is not null then");
    expect(normalizedSql).toContain(
      "raise exception 'expense is already linked to a journal entry'",
    );
  });

  it("21. existing expense-source journal rejected", () => {
    expect(normalizedSql).toContain("from public.journal_entries existing_journal");
    expect(normalizedSql).toContain("existing_journal.source_type = 'expense'");
    expect(normalizedSql).toContain("existing_journal.source_id = target_expense_id");
  });

  it("22. at least one line required", () => {
    expect(normalizedSql).toContain("if line_count < 1 then");
    expect(normalizedSql).toContain("raise exception 'at least one expense line is required'");
  });

  it("23. total > 0 required", () => {
    expect(normalizedSql).toContain("if line_total <= 0 then");
    expect(normalizedSql).toContain("raise exception 'total amount must be greater than zero'");
  });

  it("24. expense line sum must equal header total", () => {
    expect(normalizedSql).toContain("if line_total <> current_expense.total_amount then");
    expect(normalizedSql).toContain(
      "raise exception 'expense line total does not match header total'",
    );
  });

  it("25. debit accounts same organization", () => {
    expect(normalizedSql).toContain("debit_account.organization_id <> target_organization_id");
  });

  it("26. debit account type expense", () => {
    expect(normalizedSql).toContain("debit_account.account_type <> 'expense'");
  });

  it("27. debit account active", () => {
    expect(normalizedSql).toContain("debit_account.status <> 'active'");
  });

  it("28. debit account posting", () => {
    expect(normalizedSql).toContain("debit_account.is_posting is not true");
  });

  it("29. funds same organization", () => {
    expect(normalizedSql).toContain("line_fund.organization_id <> target_organization_id");
  });

  it("30. funds active", () => {
    expect(normalizedSql).toContain("line_fund.status <> 'active'");
  });

  it("31. period resolved from expense_date", () => {
    expect(normalizedSql).toContain("current_expense.expense_date >=");
    expect(normalizedSql).toContain("accounting_period.start_date");
    expect(normalizedSql).toContain("current_expense.expense_date <=");
    expect(normalizedSql).toContain("accounting_period.end_date");
  });

  it("32. period scoped to organization", () => {
    expect(normalizedSql).toContain(
      "accounting_period.organization_id = target_organization_id",
    );
  });

  it("33. inclusive date boundaries", () => {
    expect(normalizedSql).toContain("current_expense.expense_date >=");
    expect(normalizedSql).toContain("current_expense.expense_date <=");
  });

  it("34. exactly one period required", () => {
    expect(normalizedSql).toContain("if period_count <> 1 then");
    expect(normalizedSql).toContain(
      "raise exception 'accounting period could not be resolved for expense date'",
    );
  });

  it("35. open status required", () => {
    expect(normalizedSql).toContain("if matched_period.status <> 'open' then");
    expect(normalizedSql).toContain("raise exception 'accounting period is not open'");
  });

  it("36. closed rejected", () => {
    expect(normalizedSql).toContain("if matched_period.status = 'closed' then");
    expect(normalizedSql).toContain("raise exception 'accounting period is closed'");
  });

  it("37. locked rejected", () => {
    expect(normalizedSql).toContain("if matched_period.status = 'locked' then");
    expect(normalizedSql).toContain("raise exception 'accounting period is locked'");
  });

  it("38. entry date sourced from expense_date", () => {
    expect(normalizedSql).toContain("current_expense.expense_date");
    expect(normalizedSql).toMatch(
      /insert into public\.journal_entries[\s\S]*entry_date[\s\S]*current_expense\.expense_date/,
    );
  });

  it("39. credit account exists", () => {
    expect(normalizedSql).toContain("raise exception 'credit account not found'");
  });

  it("40. credit account same organization", () => {
    expect(normalizedSql).toContain(
      "matched_credit_account.organization_id <> target_organization_id",
    );
  });

  it("41. credit account active", () => {
    expect(normalizedSql).toContain("matched_credit_account.status <> 'active'");
  });

  it("42. credit account posting", () => {
    expect(normalizedSql).toContain("matched_credit_account.is_posting is not true");
  });

  it("43. bank requires asset", () => {
    expect(normalizedSql).toContain("when 'bank' then");
    expect(normalizedSql).toContain(
      "raise exception 'credit account must be an asset account for bank payment source'",
    );
  });

  it("44. cash requires asset", () => {
    expect(normalizedSql).toContain("when 'cash' then");
    expect(normalizedSql).toContain(
      "raise exception 'credit account must be an asset account for cash payment source'",
    );
  });

  it("45. card requires liability", () => {
    expect(normalizedSql).toContain("when 'card' then");
    expect(normalizedSql).toContain(
      "raise exception 'credit account must be a liability account for card payment source'",
    );
  });

  it("46. reimbursement requires liability", () => {
    expect(normalizedSql).toContain("when 'reimbursement' then");
    expect(normalizedSql).toContain(
      "raise exception 'credit account must be a liability account for reimbursement payment source'",
    );
  });

  it("47. other permits asset or liability", () => {
    expect(normalizedSql).toContain("when 'other' then");
    expect(normalizedSql).toContain(
      "matched_credit_account.account_type not in ('asset', 'liability')",
    );
  });

  it("48. revenue rejected", () => {
    expect(normalizedSql).toContain("'revenue'");
  });

  it("49. expense rejected", () => {
    expect(normalizedSql).toContain(
      "matched_credit_account.account_type in ('revenue', 'expense', 'net_asset')",
    );
  });

  it("50. net_asset rejected", () => {
    expect(normalizedSql).toContain("'net_asset'");
  });

  it("51. one journal header inserted", () => {
    expect(normalizedSql.match(/insert into public\.journal_entries/g)?.length).toBe(1);
  });

  it("52. source_type expense", () => {
    expect(normalizedSql).toContain("'expense'");
    expect(normalizedSql).toContain("source_type");
  });

  it("53. source_id expense ID", () => {
    expect(normalizedSql).toContain("target_expense_id");
    expect(normalizedSql).toContain("source_id");
  });

  it("54. status posted", () => {
    expect(normalizedSql).toContain("'posted'");
  });

  it("55. accounting period assigned", () => {
    expect(normalizedSql).toContain("matched_period.id");
    expect(normalizedSql).toContain("accounting_period_id");
  });

  it("56. organization assigned", () => {
    expect(normalizedSql).toContain("target_organization_id");
    expect(normalizedSql).toContain("organization_id");
  });

  it("57. entry number generated", () => {
    expect(normalizedSql).toContain("generated_entry_number");
    expect(normalizedSql).toContain("format(");
    expect(normalizedSql).toContain("'exp-%s'");
  });

  it("58. entry number uses the full expense UUID without truncation", () => {
    const entryNumberAssignment = normalizedSql.slice(
      normalizedSql.indexOf("generated_entry_number :="),
      normalizedSql.indexOf("insert into public.journal_entries"),
    );

    expect(entryNumberAssignment).toContain(
      "upper(replace(target_expense_id::text, '-', ''))",
    );
    expect(entryNumberAssignment).not.toContain("substr(");
    expect(entryNumberAssignment).not.toMatch(/,\s*1,\s*12/);
    expect(entryNumberAssignment).not.toMatch(/count\(\*\)/);
    expect(entryNumberAssignment).toContain("target_expense_id");
  });

  it("59. debit lines mirror expense lines", () => {
    expect(normalizedSql).toContain("for expense_line in");
    expect(normalizedSql).toContain("from public.expense_lines");
    expect(normalizedSql).toContain("expense_line.account_id");
    expect(normalizedSql).toContain("expense_line.amount");
  });

  it("60. debit line order preserved", () => {
    expect(normalizedSql).toContain("order by line_number asc");
    expect(normalizedSql).toContain("debit_line_number := debit_line_number + 1");
  });

  it("61. debit fund IDs preserved", () => {
    expect(normalizedSql).toContain("expense_line.fund_id");
  });

  it("62. debit descriptions use line fallback behavior", () => {
    expect(normalizedSql).toContain(
      "coalesce(nullif(btrim(expense_line.description), ''), current_expense.description)",
    );
  });

  it("63. one credit line per fund bucket", () => {
    expect(normalizedSql).toContain("for fund_bucket in");
    expect(normalizedSql).toContain("group by bucket.fund_id");
  });

  it("64. NULL fund treated as bucket", () => {
    expect(normalizedSql).toContain("order by bucket.fund_id nulls last");
    expect(normalizedSql).toContain("fund_bucket.fund_id");
  });

  it("65. credit account is input credit account", () => {
    expect(normalizedSql).toContain("input_credit_account_id");
  });

  it("66. credit lines come after debit lines", () => {
    const debitLoopIndex = normalizedSql.indexOf("for expense_line in");
    const creditLoopIndex = normalizedSql.indexOf("for fund_bucket in");
    expect(debitLoopIndex).toBeGreaterThan(-1);
    expect(creditLoopIndex).toBeGreaterThan(debitLoopIndex);
    expect(normalizedSql).toContain("credit_line_number := debit_line_number");
  });

  it("67. deterministic fund-bucket ordering", () => {
    expect(normalizedSql).toContain("order by bucket.fund_id nulls last");
  });

  it("68. journal debit total equals credit total", () => {
    expect(normalizedSql).toContain("if total_debits <> total_credits then");
    expect(normalizedSql).toContain("raise exception 'journal entry is not balanced'");
  });

  it("69. per-fund balance validated", () => {
    expect(normalizedSql).toContain("fund_bucket_balance.bucket_debits");
    expect(normalizedSql).toContain("fund_bucket_balance.bucket_credits");
    expect(normalizedSql).toContain(
      "raise exception 'journal entry fund buckets are not balanced'",
    );
  });

  it("70. expense status updated to recorded", () => {
    expect(normalizedSql).toContain("status = 'recorded'");
  });

  it("71. expense journal_entry_id set", () => {
    expect(normalizedSql).toContain("journal_entry_id = created_journal_entry_id");
  });

  it("72. expense total not overwritten from caller", () => {
    expect(normalizedSql).not.toMatch(/update public\.expenses[\s\S]*total_amount\s*=/);
  });

  it("73. one expense.recorded audit event", () => {
    expect(normalizedSql.match(/insert into public\.audit_events/g)?.length).toBe(1);
    expect(normalizedSql).toContain("'expense.recorded'");
  });

  it("74. audit actor user ID from auth.uid()", () => {
    expect(normalizedSql).toContain("actor_user_id");
    expect(normalizedSql).toContain("auth.uid()");
  });

  it("75. audit source ID expense ID", () => {
    expect(normalizedSql).toContain("target_expense_id");
    expect(normalizedSql).toContain("source_id");
  });

  it("76. audit description includes journal entry number", () => {
    expect(normalizedSql).toContain("generated_entry_number");
    expect(normalizedSql).toContain(
      "expense \"%s\" recorded as journal %s (total %s)",
    );
  });

  it("77. no audit event on failure path", () => {
    const auditInsertIndex = normalizedSql.indexOf("insert into public.audit_events");
    const balanceCheckIndex = normalizedSql.indexOf(
      "raise exception 'journal entry is not balanced'",
    );
    const expenseUpdateIndex = normalizedSql.indexOf("update public.expenses");

    expect(auditInsertIndex).toBeGreaterThan(balanceCheckIndex);
    expect(auditInsertIndex).toBeGreaterThan(expenseUpdateIndex);
  });

  it("78. updated expense returned", () => {
    expect(normalizedSql).toContain("return updated_expense");
    expect(normalizedSql).toContain("returning *");
  });

  it("79. no direct write RLS policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("80. no service-role application client", () => {
    expect(normalizedSql).not.toContain("service_role");
    expect(normalizedSql).not.toContain("@/lib/supabase/admin");
  });

  it("81. no void logic", () => {
    expect(normalizedSql).not.toMatch(/status = 'void'/);
    expect(normalizedSql).not.toContain("void_expense");
  });

  it("82. no reversal logic", () => {
    expect(normalizedSql).not.toMatch(/status = 'reversed'/);
    expect(normalizedSql).not.toContain("reversal_of_journal_entry_id");
  });

  it("83. no bank transaction insert", () => {
    expect(normalizedSql).not.toMatch(/\binsert into public\.bank_transactions\b/);
  });

  it("84. no payment settlement", () => {
    expect(normalizedSql).not.toMatch(/\binsert into public\.bill_payments\b/);
  });

  it("85. no payment_account_id column", () => {
    expect(normalizedSql).not.toContain("payment_account_id");
  });

  it("86. no bank_account_id column", () => {
    expect(normalizedSql).not.toContain("bank_account_id");
  });

  it("87. no posted_at column", () => {
    expect(normalizedSql).not.toContain("posted_at");
  });

  it("88. no new status values", () => {
    expect(normalizedSql).not.toMatch(/status in \([^)]*approved/);
    expect(normalizedSql).not.toContain("'pending'");
  });

  it("89. no application repository/action/UI changes", () => {
    expect(normalizedSql).not.toContain("src/");
    expect(normalizedSql).not.toContain("repository");
  });

  it("90. no destructive schema statements", () => {
    expect(normalizedSql).not.toMatch(/\bdrop table\b/);
    expect(normalizedSql).not.toMatch(/\bdrop column\b/);
    expect(normalizedSql).not.toMatch(/\bdrop index\b/);
    expect(normalizedSql).not.toMatch(/\bdelete from\b/);
    expect(normalizedSql).not.toMatch(/\btruncate\b/);
  });
});
