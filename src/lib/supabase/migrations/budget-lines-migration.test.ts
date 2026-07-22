import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_budget_lines.sql"),
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

describe("budget_lines migration", () => {
  it("has exactly one budget_lines migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.budget_lines table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.budget_lines");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each budget line to one budget with cascading delete", () => {
    expect(hasColumnDefinition("budget_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint budget_lines_budget_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (budget_id) references public.budgets(id) on delete cascade",
    );
  });

  it("links each budget line to one accounting account with restricted delete", () => {
    expect(hasColumnDefinition("account_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint budget_lines_account_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (account_id) references public.accounts(id) on delete restrict",
    );
  });

  it("optionally links each budget line to a fund with restricted delete", () => {
    expect(hasColumnDefinition("fund_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*fund_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint budget_lines_fund_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (fund_id) references public.funds(id) on delete restrict",
    );
  });

  it("requires positive line numbers unique within each budget only", () => {
    expect(hasColumnDefinition("line_number", "integer not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint budget_lines_line_number_positive",
    );
    expect(normalizedSql).toContain("check (line_number > 0)");
    expect(normalizedSql).toContain(
      "constraint budget_lines_budget_line_key unique (budget_id, line_number)",
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
      "constraint budget_lines_description_not_blank",
    );
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
    expect(hasColumnNamed("memo")).toBe(false);
    expect(hasColumnNamed("notes")).toBe(false);
  });

  it("stores one nonnegative amount without a default or floating-point type", () => {
    expect(
      hasColumnDefinition("amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*amount\s+numeric\(18,2\)\s+not\s+null\s+default\b/,
    );
    expect(normalizedSql).toContain(
      "constraint budget_lines_amount_nonnegative",
    );
    expect(normalizedSql).toContain("check (amount >= 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("does not duplicate organization ownership or add accounting periods", () => {
    expect(hasColumnNamed("organization_id")).toBe(false);
    expect(hasColumnNamed("accounting_period_id")).toBe(false);
  });

  it("does not restrict duplicate account and fund allocations", () => {
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*budget_id\s*,\s*account_id\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*budget_id\s*,\s*account_id\s*,\s*fund_id\s*\)/,
    );
  });

  it("does not include actual, variance, or derived amount columns", () => {
    const derivedColumns = [
      "actual_amount",
      "variance_amount",
      "variance_percent",
      "spent_amount",
      "remaining_amount",
      "committed_amount",
    ];

    for (const column of derivedColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include forecasting columns", () => {
    const forecastingColumns = [
      "forecast_amount",
      "projected_amount",
      "forecast_version",
    ];

    for (const column of forecastingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include monthly or period allocation columns", () => {
    const monthlyColumns = [
      "january_amount",
      "february_amount",
      "march_amount",
      "april_amount",
      "may_amount",
      "june_amount",
      "july_amount",
      "august_amount",
      "september_amount",
      "october_amount",
      "november_amount",
      "december_amount",
      "monthly_amount",
      "period_amount",
    ];

    for (const column of monthlyColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include department, ministry, or dimensional relationships", () => {
    const dimensionColumns = [
      "department_id",
      "ministry_id",
      "program_id",
      "project_id",
      "cost_center_id",
    ];

    for (const column of dimensionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include journal relationship columns", () => {
    const journalColumns = ["journal_entry_id", "journal_entry_line_id"];

    for (const column of journalColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not create trigger or function actual-versus-budget logic", () => {
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
    expect(normalizedSql).not.toContain("actual");
    expect(normalizedSql).not.toContain("variance");
    expect(normalizedSql).not.toContain("journal_entries");
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

  it("enables RLS without creating policies or auth references", () => {
    expect(normalizedSql).toContain(
      "alter table public.budget_lines enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not create future budget, forecasting, or unrelated domain tables", () => {
    const futureDomainTables = [
      "budget_periods",
      "budget_months",
      "forecasts",
      "departments",
      "ministries",
      "reconciliations",
      "members",
      "giving",
      "compliance_items",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }

    expect(normalizedSql).not.toContain("create table public.journal_entries");
  });
});
