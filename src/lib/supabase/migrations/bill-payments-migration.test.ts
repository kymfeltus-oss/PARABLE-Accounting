import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_bill_payments.sql"),
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

describe("bill_payments migration", () => {
  it("has exactly one bill_payments migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.bill_payments table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.bill_payments");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each bill payment to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bill_payments_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each bill payment to one bill with restricted delete", () => {
    expect(hasColumnDefinition("bill_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint bill_payments_bill_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (bill_id) references public.bills(id) on delete restrict",
    );
  });

  it("requires an explicit payment date without a default", () => {
    expect(hasColumnDefinition("payment_date", "date not null")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*payment_date\s+date\s+not\s+null\s+default\b/,
    );
    expect(hasColumnNamed("cleared_date")).toBe(false);
    expect(hasColumnNamed("reconciled_date")).toBe(false);
    expect(hasColumnNamed("posted_date")).toBe(false);
  });

  it("stores one positive payment amount without a default or floating-point type", () => {
    expect(
      hasColumnDefinition("amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bill_payments_amount_positive",
    );
    expect(normalizedSql).toContain("check (amount > 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("allows nullable nonblank references", () => {
    expect(hasColumnDefinition("reference", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*reference\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bill_payments_reference_not_blank",
    );
    expect(normalizedSql).toContain("reference is null");
    expect(normalizedSql).toContain("char_length(btrim(reference)) > 0");
  });

  it("restricts status to only recorded or void", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'recorded'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint bill_payments_status_valid check \( status in \( 'recorded', 'void' \) \)/,
    );

    const deferredStatusValues = [
      "pending",
      "processing",
      "failed",
      "cleared",
      "reconciled",
    ];

    for (const status of deferredStatusValues) {
      expect(normalizedSql).not.toContain(`'${status}'`);
    }
  });

  it("does not include derived bill balance columns", () => {
    const derivedBalanceColumns = [
      "remaining_balance",
      "balance_due",
      "amount_remaining",
      "total_paid",
    ];

    for (const column of derivedBalanceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include bank relationship columns", () => {
    const bankRelationshipColumns = ["bank_transaction_id", "bank_account_id"];

    for (const column of bankRelationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include accounting relationship columns", () => {
    const accountingRelationshipColumns = [
      "account_id",
      "fund_id",
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of accountingRelationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include payment method fields", () => {
    const paymentMethodColumns = [
      "payment_method",
      "payment_type",
      "check_number",
      "ach_id",
      "card_id",
    ];

    for (const column of paymentMethodColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create trigger or function workflow automation", () => {
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
    expect(normalizedSql).not.toContain("sum(");
    expect(normalizedSql).not.toContain("total_amount");
    expect(normalizedSql).not.toContain("update public.bills");
    expect(normalizedSql).not.toContain("bills.status");
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
  });

  it("enables RLS without creating policies", () => {
    expect(normalizedSql).toContain(
      "alter table public.bill_payments enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create future payment domain tables", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const futureDomainTables = [
      "expenses",
      "payments",
      "payment_methods",
      "bank_transaction_matches",
      "reconciliations",
      "members",
      "giving",
      "budgets",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }

    expect(normalizedSql).not.toContain("create table public.journal_entries");
  });
});
