import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_vendors.sql"),
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

describe("vendors migration", () => {
  it("has exactly one vendors migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.vendors table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.vendors");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each vendor to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint vendors_organization_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("requires nonblank vendor names that are unique within an organization only", () => {
    expect(hasColumnDefinition("name", "text not null")).toBe(true);
    expect(normalizedSql).toContain("constraint vendors_name_not_blank");
    expect(normalizedSql).toContain("char_length(btrim(name)) > 0");
    expect(normalizedSql).toContain(
      "constraint vendors_organization_name_key unique (organization_id, name)",
    );
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*name\s*\)/);
    expect(normalizedSql).not.toMatch(/(?:\(|,)\s*name\s+text\s+unique\b/);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*name\s+text\s+not\s+null\s+unique\b/,
    );
  });

  it("allows nullable nonblank email values without uniqueness", () => {
    expect(hasColumnDefinition("email", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*email\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint vendors_email_not_blank");
    expect(normalizedSql).toContain("email is null");
    expect(normalizedSql).toContain("char_length(btrim(email)) > 0");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*email\s*\)/);
    expect(normalizedSql).not.toMatch(/(?:\(|,)\s*email\s+text\s+unique\b/);
  });

  it("allows nullable nonblank phone values without uniqueness", () => {
    expect(hasColumnDefinition("phone", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*phone\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint vendors_phone_not_blank");
    expect(normalizedSql).toContain("phone is null");
    expect(normalizedSql).toContain("char_length(btrim(phone)) > 0");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*phone\s*\)/);
    expect(normalizedSql).not.toMatch(/(?:\(|,)\s*phone\s+text\s+unique\b/);
  });

  it("stores only optional tax ID last four digits", () => {
    expect(hasColumnDefinition("tax_id_last_four", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*tax_id_last_four\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint vendors_tax_id_last_four_valid",
    );
    expect(normalizedSql).toContain("tax_id_last_four is null");
    expect(normalizedSql).toContain("tax_id_last_four ~ '^[0-9]{4}$'");

    const fullTaxIdColumns = ["ssn", "ein", "tin", "tax_id", "taxpayer_id"];

    for (const column of fullTaxIdColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("restricts status to active or inactive with an active default", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'active'"),
    ).toBe(true);
    expect(normalizedSql).toContain("constraint vendors_status_valid");
    expect(normalizedSql).toContain("status in ('active', 'inactive')");
    expect(normalizedSql).not.toContain("'pending'");
    expect(normalizedSql).not.toContain("'archived'");
    expect(normalizedSql).not.toContain("'blocked'");
    expect(normalizedSql).not.toContain("'suspended'");
  });

  it("does not create address columns", () => {
    const addressColumns = [
      "address_line_1",
      "address_line_2",
      "city",
      "state",
      "postal_code",
      "country",
    ];

    for (const column of addressColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create payment credential columns", () => {
    const paymentCredentialColumns = [
      "account_number",
      "routing_number",
      "ach_token",
      "access_token",
      "payment_token",
      "stripe_id",
      "plaid_item_id",
    ];

    for (const column of paymentCredentialColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create financial balance or summary columns", () => {
    const financialSummaryColumns = [
      "outstanding_balance",
      "unpaid_balance",
      "total_due",
      "total_paid",
      "lifetime_spend",
      "ytd_payments",
      "form_1099_amount",
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
      "alter table public.vendors enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not reference auth users or create payable and tax workflow tables", () => {
    expect(normalizedSql).not.toContain("auth.users");

    const futureDomainTables = [
      "bills",
      "expenses",
      "vendor_payments",
      "payments",
      "vendor_tax_documents",
      "w9_documents",
      "form_1099",
      "members",
      "giving",
      "budgets",
    ];

    for (const table of futureDomainTables) {
      expect(normalizedSql).not.toMatch(
        new RegExp(`create table public\\.${table}\\b`),
      );
    }
  });
});
