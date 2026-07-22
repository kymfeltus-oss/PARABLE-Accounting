import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_expenses.sql"),
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

describe("expenses migration", () => {
  it("has exactly one expenses migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.expenses table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.expenses");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each expense to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint expenses_organization_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("optionally links each expense to a vendor with restricted delete", () => {
    expect(hasColumnDefinition("vendor_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*vendor_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint expenses_vendor_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (vendor_id) references public.vendors(id) on delete restrict",
    );
  });

  it("requires an explicit expense date without a default", () => {
    expect(hasColumnDefinition("expense_date", "date not null")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*expense_date\s+date\s+not\s+null\s+default\b/,
    );
  });

  it("requires nonblank descriptions", () => {
    expect(hasColumnDefinition("description", "text not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint expenses_description_not_blank",
    );
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
    expect(hasColumnNamed("memo")).toBe(false);
    expect(hasColumnNamed("notes")).toBe(false);
  });

  it("stores one positive total amount without a default or floating-point type", () => {
    expect(
      hasColumnDefinition("total_amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*total_amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain("constraint expenses_total_amount_positive");
    expect(normalizedSql).toContain("check (total_amount > 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("allows nullable nonblank references", () => {
    expect(hasColumnDefinition("reference", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*reference\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint expenses_reference_not_blank");
    expect(normalizedSql).toContain("reference is null");
    expect(normalizedSql).toContain("char_length(btrim(reference)) > 0");
  });

  it("restricts payment_source to the approved classifications", () => {
    expect(
      hasColumnDefinition("payment_source", "text not null default 'other'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint expenses_payment_source_valid check \( payment_source in \( 'bank', 'card', 'cash', 'reimbursement', 'other' \) \)/,
    );
  });

  it("restricts status to draft, recorded, or void", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'draft'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint expenses_status_valid check \( status in \( 'draft', 'recorded', 'void' \) \)/,
    );
  });

  it("does not create expense-line allocation columns", () => {
    const allocationColumns = [
      "account_id",
      "fund_id",
      "line_amount",
      "quantity",
      "unit_price",
      "tax_code",
    ];

    for (const column of allocationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    const deferredAmountColumns = [
      "tax_amount",
      "tip_amount",
      "fee_amount",
      "reimbursable_amount",
      "amount_paid",
      "balance_due",
    ];

    for (const column of deferredAmountColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create banking or card relationship columns", () => {
    const bankCardRelationshipColumns = [
      "bank_transaction_id",
      "bank_account_id",
      "card_account_id",
    ];

    for (const column of bankCardRelationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create journal relationship columns", () => {
    const journalRelationshipColumns = [
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of journalRelationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create reimbursement workflow columns", () => {
    const reimbursementColumns = [
      "employee_id",
      "member_id",
      "reimbursed_to_user_id",
      "reimbursement_status",
      "reimbursement_payment_id",
    ];

    for (const column of reimbursementColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not store sensitive payment credentials", () => {
    const sensitiveColumns = [
      "account_number",
      "routing_number",
      "card_number",
      "access_token",
      "payment_token",
    ];

    for (const column of sensitiveColumns) {
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
      "alter table public.expenses enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create future expense domain tables", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const futureDomainTables = [
      "expense_lines",
      "reimbursements",
      "card_accounts",
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
