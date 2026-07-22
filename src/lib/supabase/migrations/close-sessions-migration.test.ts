import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_close_sessions.sql"),
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

const getConstraintValues = (constraintName: string, columnName: string) => {
  const match = normalizedSql.match(
    new RegExp(
      `constraint ${constraintName} check \\( ${columnName} in \\( ([^)]+) \\) \\)`,
    ),
  );

  return match
    ? [...match[1].matchAll(/'([^']+)'/g)].map(([, value]) => value)
    : [];
};

describe("close_sessions migration", () => {
  it("has exactly one close_sessions migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.close_sessions table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.close_sessions");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each close session to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint close_sessions_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each close session to one accounting period with restricted delete", () => {
    expect(
      hasColumnDefinition("accounting_period_id", "uuid not null"),
    ).toBe(true);
    expect(normalizedSql).toContain(
      "constraint close_sessions_accounting_period_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (accounting_period_id) references public.accounting_periods(id) on delete restrict",
    );
  });

  it("restricts close_type to month_end, quarter_end, and year_end", () => {
    expect(
      hasColumnDefinition("close_type", "text not null default 'month_end'"),
    ).toBe(true);
    expect(getConstraintValues("close_sessions_close_type_valid", "close_type"))
      .toEqual(["month_end", "quarter_end", "year_end"]);
  });

  it("restricts status to draft, in_progress, and completed", () => {
    expect(hasColumnDefinition("status", "text not null default 'draft'")).toBe(
      true,
    );
    expect(getConstraintValues("close_sessions_status_valid", "status"))
      .toEqual(["draft", "in_progress", "completed"]);
  });

  it("allows nullable close timing fields without defaults", () => {
    expect(hasColumnDefinition("started_at", "timestamptz")).toBe(true);
    expect(hasColumnDefinition("completed_at", "timestamptz")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*started_at\s+timestamptz\s+not\s+null\b/,
    );
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*completed_at\s+timestamptz\s+not\s+null\b/,
    );
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*started_at\s+timestamptz(?:\s+not\s+null)?\s+default\b/,
    );
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*completed_at\s+timestamptz(?:\s+not\s+null)?\s+default\b/,
    );
  });

  it("requires completed_at to have a started_at value when present", () => {
    expect(normalizedSql).toContain(
      "constraint close_sessions_completion_time_valid",
    );
    expect(normalizedSql).toContain(
      "check ( completed_at is null or started_at is not null )",
    );
  });

  it("does not add close-session uniqueness constraints", () => {
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*organization_id\s*,\s*accounting_period_id\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*accounting_period_id\s*,\s*organization_id\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*accounting_period_id\s*,\s*close_type\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*close_type\s*,\s*accounting_period_id\s*\)/,
    );
  });

  it("does not include close task or count fields", () => {
    const taskColumns = ["total_tasks", "completed_tasks", "pending_tasks"];

    for (const column of taskColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include AI or readiness fields", () => {
    const aiReadinessColumns = [
      "ai_status",
      "ai_score",
      "readiness_score",
      "confidence_score",
      "ai_summary",
      "ai_recommendation",
      "model",
      "model_version",
    ];

    for (const column of aiReadinessColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include exception fields", () => {
    const exceptionColumns = [
      "exception_id",
      "open_exception_count",
      "critical_exception_count",
    ];

    for (const column of exceptionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include reconciliation fields", () => {
    const reconciliationColumns = [
      "reconciliation_id",
      "reconciliation_status",
      "unreconciled_count",
    ];

    for (const column of reconciliationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include journal or posting fields", () => {
    const journalPostingColumns = [
      "journal_entry_id",
      "closing_journal_entry_id",
      "posting_status",
    ];

    for (const column of journalPostingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include user assignment or approval columns or auth users references", () => {
    const userAssignmentColumns = [
      "owner_user_id",
      "prepared_by_user_id",
      "reviewed_by_user_id",
      "approved_by_user_id",
      "completed_by_user_id",
    ];

    for (const column of userAssignmentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include audit or document relationship fields", () => {
    const auditDocumentColumns = ["audit_event_id", "audit_document_id"];

    for (const column of auditDocumentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include derived metric fields", () => {
    const derivedMetricColumns = [
      "readiness_percentage",
      "exception_count",
      "unreconciled_count",
      "journal_count",
      "task_count",
    ];

    for (const column of derivedMetricColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("records creation and update timestamps without triggers or functions", () => {
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

  it("enables RLS without policies or indexes", () => {
    expect(normalizedSql).toContain(
      "alter table public.close_sessions enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("create index");
  });

  it("does not alter accounting periods", () => {
    expect(normalizedSql).not.toContain("alter table public.accounting_periods");
  });

  it("does not create future close workflow tables", () => {
    const futureCloseTables = [
      "close_tasks",
      "close_checklists",
      "close_approvals",
      "ai_close_reviews",
      "close_exceptions",
      "close_reconciliations",
      "closing_entries",
    ];

    for (const table of futureCloseTables) {
      expect(createsTableNamed(table)).toBe(false);
    }
  });

  it("does not add unsupported migration objects", () => {
    expect(normalizedSql).not.toContain("create view");
    expect(normalizedSql).not.toContain("create extension");
    expect(normalizedSql).not.toContain("grant ");
    expect(normalizedSql).not.toContain("insert into");
  });
});
