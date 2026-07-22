import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_bank_accounts.sql"),
);
const migrationPath =
  migrationFiles.length === 1
    ? path.join(migrationsDir, migrationFiles[0])
    : "";
const migrationSql = migrationPath ? readFileSync(migrationPath, "utf8") : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

describe("bank_accounts migration", () => {
  it("has exactly one bank_accounts migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.bank_accounts table with primary ownership columns", () => {
    expect(normalizedSql).toContain("create table public.bank_accounts");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
    expect(normalizedSql).toContain("organization_id uuid not null");
    expect(normalizedSql).toContain("account_id uuid not null");
  });

  it("links each bank account to one organization with cascading delete", () => {
    expect(normalizedSql).toContain(
      "constraint bank_accounts_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each bank account to one accounting account with restricted delete", () => {
    expect(normalizedSql).toContain("constraint bank_accounts_account_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (account_id) references public.accounts(id) on delete restrict",
    );
  });

  it("requires nonblank names that are unique within an organization only", () => {
    expect(normalizedSql).toContain("name text not null");
    expect(normalizedSql).toContain("constraint bank_accounts_name_not_blank");
    expect(normalizedSql).toContain("char_length(btrim(name)) > 0");
    expect(normalizedSql).toContain(
      "constraint bank_accounts_organization_name_key unique (organization_id, name)",
    );
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*name\s*\)/);
    expect(normalizedSql).not.toMatch(/\bname\s+text\s+not\s+null\s+unique\b/);
  });

  it("allows a nullable institution name but rejects blank provided values", () => {
    expect(normalizedSql).toContain("institution_name text");
    expect(normalizedSql).not.toMatch(
      /\binstitution_name\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bank_accounts_institution_name_not_blank",
    );
    expect(normalizedSql).toContain("institution_name is null");
    expect(normalizedSql).toContain(
      "char_length(btrim(institution_name)) > 0",
    );
  });

  it("restricts account_type to the approved bank account categories", () => {
    expect(normalizedSql).toContain(
      "account_type text not null default 'checking'",
    );
    expect(normalizedSql).toMatch(
      /constraint bank_accounts_type_valid check \( account_type in \( 'checking', 'savings', 'money_market' \) \)/,
    );
    expect(normalizedSql).not.toContain("'credit_card'");
    expect(normalizedSql).not.toContain("'loan'");
    expect(normalizedSql).not.toContain("'investment'");
    expect(normalizedSql).not.toContain("'brokerage'");
  });

  it("allows nullable last_four values and validates provided digits", () => {
    expect(normalizedSql).toContain("last_four text");
    expect(normalizedSql).not.toMatch(/\blast_four\s+text\s+not\s+null\b/);
    expect(normalizedSql).toContain("constraint bank_accounts_last_four_valid");
    expect(normalizedSql).toContain("last_four is null");
    expect(normalizedSql).toContain("last_four ~ '^[0-9]{4}$'");
  });

  it("restricts status to active or inactive with an active default", () => {
    expect(normalizedSql).toContain("status text not null default 'active'");
    expect(normalizedSql).toContain("constraint bank_accounts_status_valid");
    expect(normalizedSql).toContain("status in ('active', 'inactive')");
    expect(normalizedSql).not.toContain("'disconnected'");
    expect(normalizedSql).not.toContain("'pending'");
    expect(normalizedSql).not.toContain("'archived'");
    expect(normalizedSql).not.toContain("'closed'");
  });

  it("records creation and update timestamps without triggers", () => {
    expect(normalizedSql).toContain(
      "created_at timestamptz not null default now()",
    );
    expect(normalizedSql).toContain(
      "updated_at timestamptz not null default now()",
    );
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
  });

  it("does not store bank balances", () => {
    const balanceColumns = [
      "current_balance",
      "available_balance",
      "ledger_balance",
      "statement_balance",
      "reconciled_balance",
      "opening_balance",
    ];

    for (const column of balanceColumns) {
      expect(normalizedSql).not.toContain(column);
    }
  });

  it("does not store sensitive banking credentials or account secrets", () => {
    const sensitiveColumns = [
      "access_token",
      "refresh_token",
      "password",
      "routing_number",
      "account_number",
      "plaid_access_token",
      "plaid_item_id",
    ];

    for (const column of sensitiveColumns) {
      expect(normalizedSql).not.toContain(column);
    }
  });

  it("enables RLS without creating policies", () => {
    expect(normalizedSql).toContain(
      "alter table public.bank_accounts enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create future banking domains", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const unrelatedTables = [
      "transactions",
      "bank_transactions",
      "reconciliations",
      "members",
      "giving",
      "vendors",
      "expenses",
      "bills",
      "budgets",
    ];

    for (const table of unrelatedTables) {
      expect(normalizedSql).not.toMatch(
        new RegExp(`create table public\\.${table}\\b`),
      );
    }
  });
});
