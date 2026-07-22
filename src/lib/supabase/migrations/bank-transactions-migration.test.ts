import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_bank_transactions.sql"),
);
const migrationPath =
  migrationFiles.length === 1
    ? path.join(migrationsDir, migrationFiles[0])
    : "";
const migrationSql = migrationPath ? readFileSync(migrationPath, "utf8") : "";
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

const hasColumnDefinition = (columnName: string, definition: string) =>
  new RegExp(`(?:\\(|,)\\s*${columnName}\\s+${definition}(?=\\s*,)`).test(
    normalizedSql,
  );

const hasColumnNamed = (columnName: string) =>
  new RegExp(`(?:\\(|,)\\s*${columnName}\\s+`).test(normalizedSql);

describe("bank_transactions migration", () => {
  it("has exactly one bank_transactions migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.bank_transactions table with the primary key", () => {
    expect(normalizedSql).toContain("create table public.bank_transactions");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each bank transaction to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bank_transactions_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each bank transaction to one bank account with cascading delete", () => {
    expect(hasColumnDefinition("bank_account_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bank_transactions_bank_account_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (bank_account_id) references public.bank_accounts(id) on delete cascade",
    );
  });

  it("requires an explicit transaction date and allows a nullable posted date", () => {
    expect(hasColumnDefinition("transaction_date", "date not null")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*transaction_date\s+date\s+not\s+null\s+default\b/,
    );
    expect(hasColumnDefinition("posted_date", "date")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*posted_date\s+date\s+not\s+null\b/,
    );
  });

  it("requires nonblank transaction descriptions", () => {
    expect(hasColumnDefinition("description", "text not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bank_transactions_description_not_blank",
    );
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
  });

  it("stores one nonzero signed amount without debit or credit columns", () => {
    expect(
      hasColumnDefinition("amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bank_transactions_amount_nonzero",
    );
    expect(normalizedSql).toContain("check (amount <> 0)");
    expect(hasColumnNamed("debit_amount")).toBe(false);
    expect(hasColumnNamed("credit_amount")).toBe(false);
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("allows a nullable nonblank reference", () => {
    expect(hasColumnDefinition("reference", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*reference\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bank_transactions_reference_not_blank",
    );
    expect(normalizedSql).toContain("reference is null");
    expect(normalizedSql).toContain("char_length(btrim(reference)) > 0");
  });

  it("tracks source_type using only approved values", () => {
    expect(
      hasColumnDefinition("source_type", "text not null default 'manual'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint bank_transactions_source_type_valid check \( source_type in \( 'manual', 'import', 'bank_feed' \) \)/,
    );
  });

  it("allows nullable external IDs that are unique only within a bank account", () => {
    expect(hasColumnDefinition("external_id", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*external_id\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bank_transactions_external_id_not_blank",
    );
    expect(normalizedSql).toContain("external_id is null");
    expect(normalizedSql).toContain("char_length(btrim(external_id)) > 0");
    expect(normalizedSql).toContain(
      "constraint bank_transactions_bank_external_key unique (bank_account_id, external_id)",
    );
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*external_id\s*\)/);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*external_id\s+text\s+unique\b/,
    );
  });

  it("tracks matching status using only approved values", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'unmatched'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint bank_transactions_status_valid check \( status in \( 'unmatched', 'matched', 'excluded' \) \)/,
    );
  });

  it("does not directly connect bank transactions to ledger structures", () => {
    expect(hasColumnNamed("journal_entry_id")).toBe(false);
    expect(hasColumnNamed("journal_entry_line_id")).toBe(false);
    expect(hasColumnNamed("account_id")).toBe(false);
    expect(hasColumnNamed("fund_id")).toBe(false);
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
      expect(normalizedSql).not.toMatch(
        new RegExp(`(?:\\(|,)\\s*${column}\\s+`),
      );
    }
  });

  it("records creation and update timestamps without triggers", () => {
    expect(
      hasColumnDefinition(
        "created_at",
        "timestamptz not null default now\\(\\)",
      ),
    ).toBe(true);
    expect(
      hasColumnDefinition(
        "updated_at",
        "timestamptz not null default now\\(\\)",
      ),
    ).toBe(true);
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
  });

  it("enables RLS without creating policies", () => {
    expect(normalizedSql).toContain(
      "alter table public.bank_transactions enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create unrelated future domains", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const unrelatedTables = [
      "reconciliations",
      "bank_connections",
      "plaid_items",
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
