import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260723103000_replace_expense_draft_lines.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("replace expense draft lines RPC migration", () => {
  it("1. uses the approved migration filename", () => {
    expect(migrationPath).toContain(
      "20260723103000_replace_expense_draft_lines.sql",
    );
  });

  it("2. creates replace_expense_draft_lines with the expected signature", () => {
    expectMigrationToMatch(
      /create or replace function public\.replace_expense_draft_lines\( target_organization_id uuid, target_expense_id uuid, input_lines jsonb \)/,
    );
  });

  it("3. returns public.expenses", () => {
    expectMigrationToMatch(/returns public\.expenses/);
  });

  it("4. uses SECURITY DEFINER", () => {
    expectMigrationToMatch(/security definer/);
  });

  it("5. uses an empty search_path", () => {
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("6. rejects unauthenticated callers via auth.uid() guard", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain("raise exception 'authenticated user is required'");
  });

  it("7. allows owner via has_org_role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
    expect(normalizedSql).toContain("'owner'");
  });

  it("8. allows accountant via has_org_role", () => {
    expect(normalizedSql).toContain("'accountant'");
  });

  it("9. allows staff via has_org_role", () => {
    expect(normalizedSql).toContain("'staff'");
  });

  it("10. excludes viewer from allowed roles", () => {
    expect(normalizedSql).not.toMatch(
      /array\['owner', 'accountant', 'staff', 'viewer'\]/,
    );
    expect(normalizedSql).not.toMatch(/array\['viewer'\]/);
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("11. uses organization-scoped role check on target_organization_id", () => {
    expect(normalizedSql).toContain("if target_organization_id is null then");
    expect(normalizedSql).toContain("raise exception 'organization is required'");
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
  });

  it("12. selects the target expense by id and organization", () => {
    expect(normalizedSql).toContain("from public.expenses");
    expect(normalizedSql).toContain("where id = target_expense_id");
    expect(normalizedSql).toContain("and organization_id = target_organization_id");
  });

  it("13. locks the target expense with FOR UPDATE", () => {
    expect(normalizedSql).toContain("for update");
  });

  it("14. requires the expense to be in draft status", () => {
    expect(normalizedSql).toContain("if current_expense.status <> 'draft' then");
    expect(normalizedSql).toContain("raise exception 'expense is not in draft status'");
  });

  it("15. rejects recorded or void expense mutation through draft-only guard", () => {
    expect(normalizedSql).not.toContain("status = 'recorded'");
    expect(normalizedSql).not.toContain("status = 'void'");
    expect(normalizedSql).toContain("if current_expense.status <> 'draft' then");
  });

  it("16. requires input_lines to be a JSON array", () => {
    expect(normalizedSql).toContain("if input_lines is null then");
    expect(normalizedSql).toContain("raise exception 'allocation lines are required'");
    expect(normalizedSql).toContain("if jsonb_typeof(input_lines) <> 'array' then");
    expect(normalizedSql).toContain(
      "raise exception 'allocation lines must be a json array'",
    );
  });

  it("17. requires at least one allocation line", () => {
    expect(normalizedSql).toContain("line_count := jsonb_array_length(input_lines)");
    expect(normalizedSql).toContain("if line_count < 1 then");
    expect(normalizedSql).toContain(
      "raise exception 'at least one allocation line is required'",
    );
  });

  it("18. allows no more than 50 allocation lines", () => {
    expect(normalizedSql).toContain("if line_count > 50 then");
    expect(normalizedSql).toContain(
      "raise exception 'no more than 50 allocation lines are allowed'",
    );
  });

  it("19. requires account_id for each line", () => {
    expect(normalizedSql).toContain("if not (line_object ? 'account_id')");
    expect(normalizedSql).toContain(
      "raise exception 'account is required for each allocation line'",
    );
    expect(normalizedSql).toContain("parsed_account_id := (line_object ->> 'account_id')::uuid");
  });

  it("20. validates account organization ownership", () => {
    expect(normalizedSql).toContain("from public.accounts");
    expect(normalizedSql).toContain(
      "if matched_account.organization_id <> target_organization_id then",
    );
    expect(normalizedSql).toContain(
      "raise exception 'account does not belong to organization'",
    );
  });

  it("21. validates account_type is expense", () => {
    expect(normalizedSql).toContain("if matched_account.account_type <> 'expense' then");
    expect(normalizedSql).toContain(
      "raise exception 'account must be an expense account'",
    );
  });

  it("22. validates account status is active", () => {
    expect(normalizedSql).toContain("if matched_account.status <> 'active' then");
    expect(normalizedSql).toContain("raise exception 'account must be active'");
  });

  it("23. validates account is_posting is true", () => {
    expect(normalizedSql).toContain("if matched_account.is_posting is not true then");
    expect(normalizedSql).toContain(
      "raise exception 'account must be a posting account'",
    );
  });

  it("24. treats fund_id as optional", () => {
    expect(normalizedSql).toContain("parsed_fund_id := null");
    expect(normalizedSql).toContain("if line_object ? 'fund_id'");
    expect(normalizedSql).toContain("and line_object ->> 'fund_id' is not null");
    expect(normalizedSql).toContain("and btrim(line_object ->> 'fund_id') <> ''");
  });

  it("25. validates fund organization ownership", () => {
    expect(normalizedSql).toContain("from public.funds");
    expect(normalizedSql).toContain(
      "if matched_fund.organization_id <> target_organization_id then",
    );
    expect(normalizedSql).toContain(
      "raise exception 'fund does not belong to organization'",
    );
  });

  it("26. validates fund status is active", () => {
    expect(normalizedSql).toContain("if matched_fund.status <> 'active' then");
    expect(normalizedSql).toContain("raise exception 'fund must be active'");
  });

  it("27. validates amount is greater than zero", () => {
    expect(normalizedSql).toContain("if line_amount is null or line_amount <= 0 then");
    expect(normalizedSql).toContain("raise exception 'amount must be greater than zero'");
    expect(normalizedSql).toContain("if calculated_total <= 0 then");
    expect(normalizedSql).toContain(
      "raise exception 'total amount must be greater than zero'",
    );
  });

  it("28. validates two-decimal amount precision", () => {
    expect(normalizedSql).toContain("if line_amount <> round(line_amount, 2) then");
    expect(normalizedSql).toContain(
      "raise exception 'amount must have at most 2 decimal places'",
    );
    expect(normalizedSql).toContain("line_amount := (line_object ->> 'amount')::numeric(18,2)");
  });

  it("29. trims provided line descriptions", () => {
    expect(normalizedSql).toContain(
      "normalized_line_description := btrim(line_object ->> 'description')",
    );
  });

  it("30. rejects blank line descriptions after trim", () => {
    expect(normalizedSql).toContain("if normalized_line_description = '' then");
    expect(normalizedSql).toContain(
      "raise exception 'allocation line description cannot be blank'",
    );
    expect(normalizedSql).toContain("normalized_line_description := null");
  });

  it("31. does not trust client line_number input", () => {
    expect(normalizedSql).not.toContain("line_object ->> 'line_number'");
    expect(normalizedSql).not.toContain("line_object -> 'line_number'");
    expect(normalizedSql).toContain(
      "where object_key not in ('account_id', 'fund_id', 'amount', 'description')",
    );
  });

  it("32. assigns sequential server line numbers from array order", () => {
    expect(normalizedSql).toContain("assigned_line_number := line_index + 1");
    expect(normalizedSql).toContain("for line_index in 0..(line_count - 1) loop");
    expect(normalizedSql).toContain("order by validated_line.line_number");
  });

  it("33. validates the full payload before deleting existing lines", () => {
    const deleteIndex = normalizedSql.indexOf("delete from public.expense_lines");
    const validationLoopIndex = normalizedSql.indexOf(
      "for line_index in 0..(line_count - 1) loop",
    );
    const validatedInsertIndex = normalizedSql.indexOf(
      "insert into validated_expense_draft_lines",
    );

    expect(validationLoopIndex).toBeGreaterThan(-1);
    expect(validatedInsertIndex).toBeGreaterThan(validationLoopIndex);
    expect(deleteIndex).toBeGreaterThan(validatedInsertIndex);
  });

  it("34. deletes old lines only after validation completes", () => {
    expect(normalizedSql).toContain(
      "delete from public.expense_lines where expense_id = target_expense_id",
    );
    expect(normalizedSql).toContain("create temp table validated_expense_draft_lines");
  });

  it("35. inserts replacement lines from the validated buffer", () => {
    expect(normalizedSql).toContain("insert into public.expense_lines");
    expect(normalizedSql).toContain("from validated_expense_draft_lines as validated_line");
  });

  it("36. calculates the expense total in SQL from validated line amounts", () => {
    expect(normalizedSql).toContain("calculated_total numeric(18,2) := 0");
    expect(normalizedSql).toContain("calculated_total := calculated_total + line_amount");
  });

  it("37. updates expenses.total_amount from the calculated line sum", () => {
    expect(normalizedSql).toContain("update public.expenses");
    expect(normalizedSql).toContain("total_amount = calculated_total");
  });

  it("38. refreshes expenses.updated_at", () => {
    expect(normalizedSql).toContain("updated_at = now()");
  });

  it("39. inserts exactly one audit event", () => {
    expect(normalizedSql.match(/insert into public\.audit_events/g)?.length).toBe(1);
  });

  it("40. uses audit event type expense.draft_lines_replaced", () => {
    expect(normalizedSql).toContain("'expense.draft_lines_replaced'");
  });

  it("41. uses expense source type and target expense source id", () => {
    expect(normalizedSql).toContain("'expense'");
    expect(normalizedSql).toContain("target_expense_id");
    expect(normalizedSql).toContain("source_id");
  });

  it("42. attributes actor_user_id to auth.uid()", () => {
    expect(normalizedSql).toContain("actor_user_id");
    expect(normalizedSql).toContain("auth.uid()");
    expect(normalizedSql).toContain("'user'");
  });

  it("43. does not create journal entries", () => {
    expect(normalizedSql).not.toContain("insert into public.journal_entries");
  });

  it("44. does not create journal entry lines", () => {
    expect(normalizedSql).not.toContain("insert into public.journal_entry_lines");
  });

  it("45. revokes PUBLIC function privileges", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.replace_expense_draft_lines(uuid, uuid, jsonb) from public",
    );
  });

  it("46. revokes anon execute", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.replace_expense_draft_lines(uuid, uuid, jsonb) from anon",
    );
  });

  it("47. grants execute only to authenticated", () => {
    expect(migrationSql).toContain(
      "grant execute on function public.replace_expense_draft_lines(uuid, uuid, jsonb) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.replace_expense_draft_lines\(uuid, uuid, jsonb\) to anon/,
    );
  });

  it("48. does not add broad expense_lines write policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.expense_lines/,
    );
    expect(normalizedSql).not.toMatch(/for insert to authenticated/);
    expect(normalizedSql).not.toMatch(/for update to authenticated/);
    expect(normalizedSql).not.toMatch(/for delete to authenticated/);
  });

  it("49. does not add broad expenses write policies", () => {
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.expenses/,
    );
  });

  it("50. documents narrow scope and database-controlled totals in the function comment", () => {
    expect(migrationSql).toContain(
      "comment on function public.replace_expense_draft_lines(uuid, uuid, jsonb)",
    );
    expect(migrationSql.toLowerCase()).toContain("draft expense line allocation");
    expect(migrationSql.toLowerCase()).toContain("line numbers and totals are database-controlled");
    expect(migrationSql.toLowerCase()).toContain("recording");
    expect(migrationSql.toLowerCase()).toContain("journal posting");
    expect(migrationSql.toLowerCase()).toContain("voiding");
    expect(migrationSql.toLowerCase()).toContain("separate workflows");
    expect(migrationSql.toLowerCase()).toContain("recalculates expenses.total_amount");
  });
});
