import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_giving_transactions.sql"),
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

const createsTableNamed = (tableName: string) =>
  new RegExp(`create table public\\.${tableName}\\b`).test(normalizedSql);

describe("giving_transactions migration", () => {
  it("has exactly one giving_transactions migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.giving_transactions table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.giving_transactions");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each giving transaction to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint giving_transactions_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("optionally links each giving transaction to a member and preserves history when members are removed", () => {
    expect(hasColumnDefinition("member_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*member_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint giving_transactions_member_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (member_id) references public.members(id) on delete set null",
    );
  });

  it("optionally links each giving transaction to a fund with restricted delete", () => {
    expect(hasColumnDefinition("fund_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*fund_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint giving_transactions_fund_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (fund_id) references public.funds(id) on delete restrict",
    );
  });

  it("requires an explicit transaction date without a default", () => {
    expect(hasColumnDefinition("transaction_date", "date not null")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*transaction_date\s+date\s+not\s+null\s+default\b/,
    );
    expect(hasColumnNamed("posted_date")).toBe(false);
    expect(hasColumnNamed("settlement_date")).toBe(false);
    expect(hasColumnNamed("deposit_date")).toBe(false);
    expect(hasColumnNamed("receipt_date")).toBe(false);
  });

  it("stores one positive contribution amount without a default or floating-point type", () => {
    expect(
      hasColumnDefinition("amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain(
      "constraint giving_transactions_amount_positive",
    );
    expect(normalizedSql).toContain("check (amount > 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("restricts giving_method to the approved classifications", () => {
    expect(
      hasColumnDefinition("giving_method", "text not null default 'other'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint giving_transactions_method_valid check \( giving_method in \( 'cash', 'check', 'card', 'ach', 'other' \) \)/,
    );
  });

  it("allows nullable nonblank references", () => {
    expect(hasColumnDefinition("reference", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*reference\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint giving_transactions_reference_not_blank",
    );
    expect(normalizedSql).toContain("reference is null");
    expect(normalizedSql).toContain("char_length(btrim(reference)) > 0");
  });

  it("restricts status to recorded or void without processor states", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'recorded'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint giving_transactions_status_valid check \( status in \( 'recorded', 'void' \) \)/,
    );

    const processorStates = [
      "pending",
      "processing",
      "settled",
      "failed",
      "refunded",
      "disputed",
      "chargeback",
    ];

    for (const state of processorStates) {
      expect(normalizedSql).not.toContain(`'${state}'`);
    }
  });

  it("does not store payment credentials", () => {
    const credentialColumns = [
      "card_number",
      "routing_number",
      "bank_account_number",
      "payment_token",
      "processor_token",
    ];

    for (const column of credentialColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include processor relationship columns", () => {
    const processorColumns = [
      "processor",
      "processor_id",
      "processor_transaction_id",
      "payment_intent_id",
      "charge_id",
      "customer_id",
      "subscription_id",
    ];

    for (const column of processorColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include recurring-giving relationship columns", () => {
    const recurringColumns = [
      "recurring_gift_id",
      "recurring_schedule_id",
      "recurrence_rule",
    ];

    for (const column of recurringColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include pledge or campaign columns", () => {
    const pledgeColumns = [
      "pledge_id",
      "campaign_id",
      "pledge_balance",
      "pledged_amount",
    ];

    for (const column of pledgeColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include receipt or tax-statement columns", () => {
    const receiptTaxColumns = [
      "receipt_number",
      "receipt_generated_at",
      "tax_statement_id",
      "deductible_amount",
      "nondeductible_amount",
    ];

    for (const column of receiptTaxColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include bank or deposit matching columns", () => {
    const bankDepositColumns = [
      "bank_transaction_id",
      "bank_account_id",
      "deposit_id",
      "batch_id",
    ];

    for (const column of bankDepositColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include accounting relationship columns", () => {
    const accountingColumns = [
      "account_id",
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of accountingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include derived donor total columns", () => {
    const donorTotalColumns = [
      "lifetime_giving",
      "year_to_date_giving",
      "donor_total",
      "member_total",
    ];

    for (const column of donorTotalColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not reference auth users", () => {
    expect(normalizedSql).not.toContain("auth.users");
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
      "alter table public.giving_transactions enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not create future giving, processor, banking, or journal tables", () => {
    const futureDomainTables = [
      "recurring_gifts",
      "recurring_schedules",
      "pledges",
      "campaigns",
      "contribution_receipts",
      "tax_statements",
      "payment_processors",
      "deposit_batches",
      "bank_transaction_matches",
      "reconciliations",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }

    expect(normalizedSql).not.toContain("create table public.journal_entries");
  });
});
