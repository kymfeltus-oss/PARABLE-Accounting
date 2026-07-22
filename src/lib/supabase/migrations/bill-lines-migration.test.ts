import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_bill_lines.sql"),
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

describe("bill_lines migration", () => {
  it("has exactly one bill_lines migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.bill_lines table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.bill_lines");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each bill line to one bill with cascading delete", () => {
    expect(hasColumnDefinition("bill_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint bill_lines_bill_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (bill_id) references public.bills(id) on delete cascade",
    );
  });

  it("links each bill line to one accounting account with restricted delete", () => {
    expect(hasColumnDefinition("account_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint bill_lines_account_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (account_id) references public.accounts(id) on delete restrict",
    );
  });

  it("optionally links each bill line to a fund with restricted delete", () => {
    expect(hasColumnDefinition("fund_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*fund_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint bill_lines_fund_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (fund_id) references public.funds(id) on delete restrict",
    );
  });

  it("requires positive line numbers unique within each bill only", () => {
    expect(hasColumnDefinition("line_number", "integer not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bill_lines_line_number_positive",
    );
    expect(normalizedSql).toContain("check (line_number > 0)");
    expect(normalizedSql).toContain(
      "constraint bill_lines_bill_line_key unique (bill_id, line_number)",
    );
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*line_number\s*\)/);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*line_number\s+integer\s+not\s+null\s+unique\b/,
    );
  });

  it("allows nullable nonblank descriptions", () => {
    expect(hasColumnDefinition("description", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*description\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint bill_lines_description_not_blank",
    );
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
  });

  it("stores one positive amount without a default or floating-point type", () => {
    expect(
      hasColumnDefinition("amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain("constraint bill_lines_amount_positive");
    expect(normalizedSql).toContain("check (amount > 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("does not add tax, discount, quantity, or unit-price columns", () => {
    const deferredColumns = [
      "tax_amount",
      "discount_amount",
      "quantity",
      "unit_price",
    ];

    for (const column of deferredColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not duplicate organization ownership on bill lines", () => {
    expect(hasColumnNamed("organization_id")).toBe(false);
  });

  it("does not include payment relationship columns", () => {
    const paymentRelationshipColumns = [
      "payment_id",
      "bill_payment_id",
      "bank_transaction_id",
    ];

    for (const column of paymentRelationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include journal relationship columns", () => {
    const journalRelationshipColumns = [
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of journalRelationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create trigger or function total validation", () => {
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
    expect(normalizedSql).not.toContain("sum(");
    expect(normalizedSql).not.toContain("total_amount");
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
      "alter table public.bill_lines enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create future payable domain tables", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const futureDomainTables = [
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
