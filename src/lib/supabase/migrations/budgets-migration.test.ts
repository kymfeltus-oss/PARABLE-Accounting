import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_budgets.sql"),
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

describe("budgets migration", () => {
  it("has exactly one budgets migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.budgets table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.budgets");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each budget to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint budgets_organization_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("requires nonblank budget names without unique constraints", () => {
    expect(hasColumnDefinition("name", "text not null")).toBe(true);
    expect(normalizedSql).toContain("constraint budgets_name_not_blank");
    expect(normalizedSql).toContain("char_length(btrim(name)) > 0");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*name\s*\)/);
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*organization_id\s*,\s*name\s*\)/,
    );
    expect(normalizedSql).not.toMatch(/(?:\(|,)\s*name\s+text\s+unique\b/);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*name\s+text\s+not\s+null\s+unique\b/,
    );
    expect(hasColumnNamed("code")).toBe(false);
    expect(hasColumnNamed("description")).toBe(false);
    expect(hasColumnNamed("notes")).toBe(false);
  });

  it("requires explicit start and end dates with a valid range", () => {
    expect(hasColumnDefinition("start_date", "date not null")).toBe(true);
    expect(hasColumnDefinition("end_date", "date not null")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*start_date\s+date\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*end_date\s+date\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain("constraint budgets_date_range_valid");
    expect(normalizedSql).toContain("check (end_date >= start_date)");
  });

  it("does not create overlap-prevention triggers or functions", () => {
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
    expect(normalizedSql).not.toContain("overlap");
    expect(normalizedSql).not.toContain("daterange");
  });

  it("restricts status to draft, active, or closed", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'draft'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint budgets_status_valid check \( status in \( 'draft', 'active', 'closed' \) \)/,
    );
  });

  it("does not include accounting period, fund, account, or journal relationships", () => {
    const relationshipColumns = [
      "accounting_period_id",
      "fund_id",
      "account_id",
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of relationshipColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not store budget totals or derived actual values", () => {
    const amountColumns = [
      "amount",
      "total_amount",
      "budget_amount",
      "allocated_amount",
      "spent_amount",
      "actual_amount",
      "variance_amount",
      "remaining_amount",
    ];

    for (const column of amountColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include forecasting columns", () => {
    const forecastingColumns = [
      "forecast_amount",
      "projected_amount",
      "forecast_status",
      "forecast_version",
    ];

    for (const column of forecastingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include versioning or revision columns", () => {
    const versioningColumns = [
      "version",
      "revision",
      "revision_number",
      "parent_budget_id",
      "superseded_by_id",
    ];

    for (const column of versioningColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include approval workflow columns", () => {
    const approvalColumns = [
      "approved_by",
      "approved_by_user_id",
      "approved_at",
      "submitted_at",
      "approval_status",
    ];

    for (const column of approvalColumns) {
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
      "alter table public.budgets enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not create future budget, forecasting, or unrelated domain tables", () => {
    const futureDomainTables = [
      "budget_lines",
      "budget_versions",
      "budget_approvals",
      "forecasts",
      "reconciliations",
      "members",
      "giving",
      "compliance_items",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }
  });
});
