import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260718224000_create_membership_rls_policies.sql",
);

const FORBIDDEN_PATTERNS = [
  { label: "USING (true)", pattern: /using\s*\(\s*true\s*\)/i },
  { label: "WITH CHECK (true)", pattern: /with check\s*\(\s*true\s*\)/i },
  { label: "TO anon", pattern: /\bto\s+anon\b/i },
  { label: "TO public role", pattern: /\bto\s+public\b/i },
  { label: "auth.jwt tenant trust", pattern: /auth\.jwt\(\)/i },
  { label: "authenticated INSERT", pattern: /for insert[\s\S]*to authenticated/i },
  { label: "authenticated UPDATE", pattern: /for update[\s\S]*to authenticated/i },
  { label: "authenticated DELETE", pattern: /for delete[\s\S]*to authenticated/i },
  { label: "service-role key reference", pattern: /service_role|supabase_service_role_key/i },
];

describe("membership RLS migration static safety", () => {
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

  it.each(FORBIDDEN_PATTERNS)("does not contain $label", ({ pattern }) => {
    expect(migrationSql).not.toMatch(pattern);
  });

  it("uses auth.uid() as the membership authority", () => {
    expect(migrationSql).toContain("auth.uid()");
    expect(migrationSql).toContain("public.organization_memberships");
  });

  it("hardens the SECURITY DEFINER helper search_path and grants", () => {
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).not.toMatch(/set search_path = public/i);
    expect(migrationSql).toContain(
      "revoke all on function public.is_organization_member(uuid) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.is_organization_member(uuid) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.is_organization_member(uuid) to authenticated",
    );
    expect(migrationSql).not.toMatch(
      /grant execute on function public\.is_organization_member\(uuid\) to anon/i,
    );
  });

  it("uses explicit named policies for every table", () => {
    const policyNames = [
      "organizations_select_member",
      "organization_memberships_select_self",
      "funds_select_member",
      "accounts_select_member",
      "accounting_periods_select_member",
      "journal_entries_select_member",
      "journal_entry_lines_select_member_via_journal",
      "bank_accounts_select_member",
      "bank_transactions_select_member",
      "vendors_select_member",
      "bills_select_member",
      "bill_lines_select_member_via_bill",
      "bill_payments_select_member",
      "expenses_select_member",
      "expense_lines_select_member_via_expense",
      "budgets_select_member",
      "budget_lines_select_member_via_budget",
      "members_select_member",
      "giving_transactions_select_member",
      "compliance_items_select_member",
      "exceptions_select_member",
      "audit_events_select_member",
      "audit_documents_select_member",
      "reconciliations_select_member",
      "reconciliation_items_select_member",
      "bank_transaction_matches_select_member",
      "close_sessions_select_member",
      "close_tasks_select_member",
    ];

    for (const policyName of policyNames) {
      expect(migrationSql).toContain(`create policy ${policyName}`);
    }
  });
});
