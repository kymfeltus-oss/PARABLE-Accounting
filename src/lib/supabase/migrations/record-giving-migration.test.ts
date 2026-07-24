import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationFilename = "20260729113000_record_giving.sql";
const migrationPath = join(migrationsDirectory, migrationFilename);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("record giving RPC migration", () => {
  it("1. migration file exists", () => {
    const matchingFiles = readdirSync(migrationsDirectory).filter((file) =>
      file.endsWith("_record_giving.sql"),
    );

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toBe(migrationFilename);
  });

  it("2. exact function name exists", () => {
    expectMigrationToMatch(/create or replace function public\.record_giving/);
  });

  it("3. exact four-UUID signature exists", () => {
    expectMigrationToMatch(
      /create or replace function public\.record_giving\( target_organization_id uuid, target_giving_transaction_id uuid, input_debit_account_id uuid, input_credit_account_id uuid \)/,
    );
  });

  it("4. returns public.giving_transactions", () => {
    expectMigrationToMatch(/returns public\.giving_transactions/);
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
      "revoke all on function public.record_giving(uuid, uuid, uuid, uuid) from public",
    );
  });

  it("9. anon execute revoked", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.record_giving(uuid, uuid, uuid, uuid) from anon",
    );
  });

  it("10. authenticated execute granted", () => {
    expect(migrationSql).toContain(
      "grant execute on function public.record_giving(uuid, uuid, uuid, uuid) to authenticated",
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
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("16. organization role helper used", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
  });

  it("17. giving scoped by ID and organization", () => {
    expect(normalizedSql).toContain("where id = target_giving_transaction_id");
    expect(normalizedSql).toContain("and organization_id = target_organization_id");
  });

  it("18. giving locked FOR UPDATE", () => {
    expect(normalizedSql).toContain("for update");
  });

  it("19. recorded status required", () => {
    expect(normalizedSql).toContain("if current_giving.status <> 'recorded' then");
    expect(normalizedSql).toContain(
      "raise exception 'giving transaction is not in recorded status'",
    );
  });

  it("20. non-null journal_entry_id rejected", () => {
    expect(normalizedSql).toContain("if current_giving.journal_entry_id is not null then");
    expect(normalizedSql).toContain(
      "raise exception 'giving transaction is already linked to a journal entry'",
    );
  });

  it("21. existing giving-source journal rejected", () => {
    expect(normalizedSql).toContain("from public.journal_entries existing_journal");
    expect(normalizedSql).toContain("existing_journal.source_type = 'giving'");
    expect(normalizedSql).toContain(
      "existing_journal.source_id = target_giving_transaction_id",
    );
  });

  it("22. amount > 0 required", () => {
    expect(normalizedSql).toContain("if current_giving.amount <= 0 then");
    expect(normalizedSql).toContain("raise exception 'giving amount must be greater than zero'");
  });

  it("23. period resolved from transaction_date", () => {
    expect(normalizedSql).toContain("current_giving.transaction_date >=");
    expect(normalizedSql).toContain("current_giving.transaction_date <=");
  });

  it("24. exactly one period required", () => {
    expect(normalizedSql).toContain("if period_count <> 1 then");
    expect(normalizedSql).toContain(
      "raise exception 'accounting period could not be resolved for giving date'",
    );
  });

  it("25. open status required", () => {
    expect(normalizedSql).toContain("if matched_period.status <> 'open' then");
    expect(normalizedSql).toContain("raise exception 'accounting period is not open'");
  });

  it("26. closed rejected", () => {
    expect(normalizedSql).toContain("if matched_period.status = 'closed' then");
    expect(normalizedSql).toContain("raise exception 'accounting period is closed'");
  });

  it("27. locked rejected", () => {
    expect(normalizedSql).toContain("if matched_period.status = 'locked' then");
    expect(normalizedSql).toContain("raise exception 'accounting period is locked'");
  });

  it("28. debit account same organization", () => {
    expect(normalizedSql).toContain(
      "matched_debit_account.organization_id <> target_organization_id",
    );
  });

  it("29. debit account active", () => {
    expect(normalizedSql).toContain("matched_debit_account.status <> 'active'");
  });

  it("30. debit account posting", () => {
    expect(normalizedSql).toContain("matched_debit_account.is_posting is not true");
  });

  it("31. cash requires asset debit", () => {
    expect(normalizedSql).toContain("when 'cash' then");
    expect(normalizedSql).toContain(
      "raise exception 'debit account must be an asset account for cash giving method'",
    );
  });

  it("32. check requires asset debit", () => {
    expect(normalizedSql).toContain("when 'check' then");
    expect(normalizedSql).toContain(
      "raise exception 'debit account must be an asset account for check giving method'",
    );
  });

  it("33. ach requires asset debit", () => {
    expect(normalizedSql).toContain("when 'ach' then");
    expect(normalizedSql).toContain(
      "raise exception 'debit account must be an asset account for ach giving method'",
    );
  });

  it("34. card permits asset or liability debit", () => {
    expect(normalizedSql).toContain("when 'card' then");
    expect(normalizedSql).toContain(
      "matched_debit_account.account_type not in ('asset', 'liability')",
    );
  });

  it("35. credit account must be revenue", () => {
    expect(normalizedSql).toContain("matched_credit_account.account_type <> 'revenue'");
    expect(normalizedSql).toContain("raise exception 'credit account must be a revenue account'");
  });

  it("36. one journal header inserted", () => {
    expect(normalizedSql.match(/insert into public\.journal_entries/g)?.length).toBe(1);
  });

  it("37. source_type giving", () => {
    expect(normalizedSql).toContain("'giving'");
    expect(normalizedSql).toContain("source_type");
  });

  it("38. source_id giving transaction ID", () => {
    expect(normalizedSql).toContain("target_giving_transaction_id");
    expect(normalizedSql).toContain("source_id");
  });

  it("39. status posted", () => {
    expect(normalizedSql).toContain("'posted'");
  });

  it("40. entry number generated with GIV prefix", () => {
    expect(normalizedSql).toContain("generated_entry_number");
    expect(normalizedSql).toContain("'giv-%s'");
  });

  it("41. entry number uses full giving UUID without truncation", () => {
    const entryNumberAssignment = normalizedSql.slice(
      normalizedSql.indexOf("generated_entry_number :="),
      normalizedSql.indexOf("insert into public.journal_entries"),
    );

    expect(entryNumberAssignment).toContain(
      "upper(replace(target_giving_transaction_id::text, '-', ''))",
    );
    expect(entryNumberAssignment).not.toContain("substr(");
  });

  it("42. two journal lines inserted", () => {
    expect(normalizedSql.match(/insert into public\.journal_entry_lines/g)?.length).toBe(2);
  });

  it("43. debit line uses input debit account", () => {
    expect(normalizedSql).toContain("input_debit_account_id");
  });

  it("44. credit line uses input credit account", () => {
    expect(normalizedSql).toContain("input_credit_account_id");
  });

  it("45. fund_id preserved on both lines", () => {
    expect(normalizedSql).toContain("current_giving.fund_id");
  });

  it("46. journal debit total equals credit total", () => {
    expect(normalizedSql).toContain("if total_debits <> total_credits then");
    expect(normalizedSql).toContain("raise exception 'journal entry is not balanced'");
  });

  it("47. journal total matches giving amount", () => {
    expect(normalizedSql).toContain("if total_debits <> current_giving.amount then");
    expect(normalizedSql).toContain(
      "raise exception 'journal entry total does not match giving amount'",
    );
  });

  it("48. giving journal_entry_id set", () => {
    expect(normalizedSql).toContain("journal_entry_id = created_journal_entry_id");
  });

  it("49. giving status not changed", () => {
    expect(normalizedSql).not.toMatch(/update public\.giving_transactions[\s\S]*status\s*=/);
  });

  it("50. one giving.recorded audit event", () => {
    expect(normalizedSql.match(/insert into public\.audit_events/g)?.length).toBe(1);
    expect(normalizedSql).toContain("'giving.recorded'");
  });

  it("51. audit actor user ID from auth.uid()", () => {
    expect(normalizedSql).toContain("actor_user_id");
    expect(normalizedSql).toContain("auth.uid()");
  });

  it("52. updated giving returned", () => {
    expect(normalizedSql).toContain("return updated_giving");
    expect(normalizedSql).toContain("returning *");
  });

  it("53. no direct write RLS policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/alter policy/);
  });

  it("54. no reversal logic", () => {
    expect(normalizedSql).not.toMatch(/status = 'reversed'/);
    expect(normalizedSql).not.toContain("reverses_journal_entry_id");
  });

  it("55. no void logic", () => {
    expect(normalizedSql).not.toMatch(/status = 'void'/);
  });

  it("56. no destructive schema statements", () => {
    expect(normalizedSql).not.toMatch(/\bdrop table\b/);
    expect(normalizedSql).not.toMatch(/\bdrop column\b/);
    expect(normalizedSql).not.toMatch(/\bdelete from\b/);
    expect(normalizedSql).not.toMatch(/\btruncate\b/);
  });
});
