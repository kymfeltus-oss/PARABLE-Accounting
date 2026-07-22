import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const rlsMigrationFiles = readdirSync(migrationsDirectory).filter((file) =>
  file.endsWith("_create_membership_rls_policies.sql"),
);
const migrationSql =
  rlsMigrationFiles.length === 1
    ? readFileSync(join(migrationsDirectory, rlsMigrationFiles[0]!), "utf8")
    : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

const APPLICATION_TABLES = [
  "organizations",
  "organization_memberships",
  "funds",
  "accounts",
  "accounting_periods",
  "journal_entries",
  "journal_entry_lines",
  "bank_accounts",
  "bank_transactions",
  "vendors",
  "bills",
  "bill_lines",
  "bill_payments",
  "expenses",
  "expense_lines",
  "budgets",
  "budget_lines",
  "members",
  "giving_transactions",
  "compliance_items",
  "exceptions",
  "audit_events",
  "audit_documents",
  "reconciliations",
  "reconciliation_items",
  "bank_transaction_matches",
  "close_sessions",
  "close_tasks",
] as const;

const DIRECT_ORG_TABLES = APPLICATION_TABLES.filter(
  (table) =>
    table !== "organizations" &&
    table !== "organization_memberships" &&
    ![
      "journal_entry_lines",
      "bill_lines",
      "expense_lines",
      "budget_lines",
    ].includes(table),
);

const CHILD_TABLE_POLICIES = [
  {
    table: "journal_entry_lines",
    policy: "journal_entry_lines_select_member_via_journal",
    parent: "journal_entries",
  },
  {
    table: "bill_lines",
    policy: "bill_lines_select_member_via_bill",
    parent: "bills",
  },
  {
    table: "expense_lines",
    policy: "expense_lines_select_member_via_expense",
    parent: "expenses",
  },
  {
    table: "budget_lines",
    policy: "budget_lines_select_member_via_budget",
    parent: "budgets",
  },
] as const;

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("membership RLS policies migration", () => {
  it("has exactly one create_membership_rls_policies migration file", () => {
    expect(rlsMigrationFiles).toHaveLength(1);
  });

  it("creates a SECURITY DEFINER membership helper with hardened search_path", () => {
    expectMigrationToMatch(
      /create or replace function public\.is_organization_member\(\s*target_organization_id uuid\s*\)/,
    );
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
    expect(normalizedSql).not.toMatch(/set search_path = public/);
    expectMigrationToMatch(/from public\.organization_memberships membership/);
    expectMigrationToMatch(/membership\.user_id = auth\.uid\(\)/);
    expectMigrationToMatch(
      /revoke all on function public\.is_organization_member\(uuid\) from public/,
    );
    expectMigrationToMatch(
      /revoke execute on function public\.is_organization_member\(uuid\) from anon/,
    );
    expectMigrationToMatch(
      /grant execute on function public\.is_organization_member\(uuid\) to authenticated/,
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.is_organization_member\(uuid\) to anon/,
    );
  });

  it("does not expose membership rows through the helper return type", () => {
    expectMigrationToMatch(/returns boolean/);
    expect(normalizedSql).not.toMatch(/returns setof/);
    expect(normalizedSql).not.toMatch(/returns table/);
  });

  it("creates membership-backed organizations SELECT policy for authenticated users", () => {
    expectMigrationToMatch(
      /create policy organizations_select_member on public\.organizations for select to authenticated using \(public\.is_organization_member\(id\)\)/,
    );
  });

  it("creates self-only organization_memberships SELECT policy", () => {
    expectMigrationToMatch(
      /create policy organization_memberships_select_self on public\.organization_memberships for select to authenticated using \(user_id = auth\.uid\(\)\)/,
    );
  });

  it.each(DIRECT_ORG_TABLES)(
    "creates authenticated SELECT policy for direct org-scoped table %s",
    (table) => {
      expectMigrationToMatch(
        new RegExp(
          `create policy ${table}_select_member on public\\.${table} for select to authenticated using \\(public\\.is_organization_member\\(organization_id\\)\\)`,
        ),
      );
    },
  );

  it.each(CHILD_TABLE_POLICIES)(
    "creates parent-based SELECT policy for child table $table",
    ({ table, policy, parent }) => {
      expectMigrationToMatch(
        new RegExp(`create policy ${policy} on public\\.${table} for select to authenticated using`),
      );
      expectMigrationToMatch(new RegExp(`from public\\.${parent}`));
      expectMigrationToMatch(/public\.is_organization_member\(/);
    },
  );

  it("creates read-only audit table policies for authenticated members", () => {
    expectMigrationToMatch(
      /create policy audit_events_select_member on public\.audit_events for select to authenticated using \(public\.is_organization_member\(organization_id\)\)/,
    );
    expectMigrationToMatch(
      /create policy audit_documents_select_member on public\.audit_documents for select to authenticated using \(public\.is_organization_member\(organization_id\)\)/,
    );
  });

  it("does not create anon policies", () => {
    expect(normalizedSql).not.toMatch(/\bto anon\b/);
  });

  it("does not create authenticated INSERT policies", () => {
    expect(normalizedSql).not.toMatch(/for insert[\s\S]*to authenticated/);
  });

  it("does not create authenticated UPDATE policies", () => {
    expect(normalizedSql).not.toMatch(/for update[\s\S]*to authenticated/);
  });

  it("does not create authenticated DELETE policies", () => {
    expect(normalizedSql).not.toMatch(/for delete[\s\S]*to authenticated/);
  });

  it("does not modify table definitions or schema objects", () => {
    expect(normalizedSql).not.toMatch(/create table/);
    expect(normalizedSql).not.toMatch(/alter table .* add column/);
    expect(normalizedSql).not.toMatch(/alter table .* add constraint/);
    expect(normalizedSql).not.toMatch(/references auth\.users/);
  });

  it("creates exactly one SELECT policy per application table", () => {
    const policyMatches = migrationSql.match(/create policy /g) ?? [];

    expect(policyMatches).toHaveLength(APPLICATION_TABLES.length);
  });

  it("does not trust JWT custom metadata for tenant resolution", () => {
    expect(normalizedSql).not.toMatch(/auth\.jwt\(\)/);
    expect(normalizedSql).not.toMatch(/current_setting\(/);
  });
});

describe("historical migrations still enable RLS without policies", () => {
  it.each(APPLICATION_TABLES)(
    "keeps RLS enabled on %s in the original create migration",
    (table) => {
      const createMigrationFile = readdirSync(migrationsDirectory).find((file) =>
        file.endsWith(`_create_${table}.sql`),
      );

      expect(createMigrationFile).toBeDefined();

      const createMigrationSql = readFileSync(
        join(migrationsDirectory, createMigrationFile!),
        "utf8",
      )
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      expect(createMigrationSql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
      expect(createMigrationSql).not.toMatch(/create policy/);
    },
  );
});
