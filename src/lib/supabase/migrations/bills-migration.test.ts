import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_bills.sql"),
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

describe("bills migration", () => {
  it("has exactly one bills migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.bills table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.bills");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each bill to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint bills_organization_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each bill to one vendor with restricted delete", () => {
    expect(hasColumnDefinition("vendor_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint bills_vendor_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (vendor_id) references public.vendors(id) on delete restrict",
    );
  });

  it("allows nullable bill numbers that are unique within a vendor only", () => {
    expect(hasColumnDefinition("bill_number", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*bill_number\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint bills_bill_number_not_blank");
    expect(normalizedSql).toContain("bill_number is null");
    expect(normalizedSql).toContain("char_length(btrim(bill_number)) > 0");
    expect(normalizedSql).toContain(
      "constraint bills_vendor_number_key unique (vendor_id, bill_number)",
    );
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*bill_number\s*\)/);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*bill_number\s+text\s+unique\b/,
    );
  });

  it("requires an explicit bill date and allows a nullable due date", () => {
    expect(hasColumnDefinition("bill_date", "date not null")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*bill_date\s+date\s+not\s+null\s+default\b/,
    );
    expect(hasColumnDefinition("due_date", "date")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*due_date\s+date\s+not\s+null\b/,
    );
  });

  it("allows nullable nonblank descriptions", () => {
    expect(hasColumnDefinition("description", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*description\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint bills_description_not_blank");
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
  });

  it("stores one positive total amount without a default", () => {
    expect(
      hasColumnDefinition("total_amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*total_amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain("constraint bills_total_amount_positive");
    expect(normalizedSql).toContain("check (total_amount > 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("restricts status to only the approved bill states", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'draft'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint bills_status_valid check \( status in \( 'draft', 'open', 'paid', 'void' \) \)/,
    );
    expect(normalizedSql).not.toContain("'overdue'");
    expect(normalizedSql).not.toContain("'partially_paid'");
    expect(normalizedSql).not.toContain("'archived'");
    expect(normalizedSql).not.toContain("'deleted'");
  });

  it("does not include bill-line allocation columns", () => {
    const billLineColumns = [
      "account_id",
      "fund_id",
      "quantity",
      "unit_price",
      "line_amount",
    ];

    for (const column of billLineColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include payment or journal-entry relationship columns", () => {
    const relationshipColumns = [
      "bill_payment_id",
      "payment_id",
      "bank_transaction_id",
      "journal_entry_id",
    ];

    for (const column of relationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include derived financial summary columns", () => {
    const financialSummaryColumns = [
      "amount_paid",
      "balance_due",
      "outstanding_balance",
      "remaining_balance",
    ];

    for (const column of financialSummaryColumns) {
      expect(hasColumnNamed(column)).toBe(false);
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
      "alter table public.bills enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create future payable domain tables", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const futureDomainTables = [
      "bill_lines",
      "bill_payments",
      "payments",
      "expenses",
      "members",
      "giving",
      "budgets",
      "reconciliations",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }

    expect(normalizedSql).not.toContain("create table public.journal_entries");
  });
});
