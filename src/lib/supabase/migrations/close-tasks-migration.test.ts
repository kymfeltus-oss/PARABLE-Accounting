import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_close_tasks.sql"),
);

const migrationPath =
  migrationFiles.length === 1
    ? path.join(migrationsDir, migrationFiles[0])
    : "";

const migrationSql = migrationPath
  ? readFileSync(migrationPath, "utf8")
  : "";

const normalizedSql = migrationSql
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const hasColumnDefinition = (
  columnName: string,
  definition: string,
) =>
  new RegExp(
    `(?:\\(|,)\\s*${columnName}\\s+${definition}(?=\\s*,|\\s*constraint|\\s*\\))`,
  ).test(normalizedSql);

const hasColumnNamed = (columnName: string) =>
  new RegExp(`(?:\\(|,)\\s*${columnName}\\s+`).test(normalizedSql);

const createsTableNamed = (tableName: string) =>
  new RegExp(`create table public\\.${tableName}\\b`).test(
    normalizedSql,
  );

const getConstraintValues = (
  constraintName: string,
  columnName: string,
) => {
  const match = normalizedSql.match(
    new RegExp(
      `constraint ${constraintName} check \\( ${columnName} in \\( ([^)]+) \\) \\)`,
    ),
  );

  return match
    ? [...match[1].matchAll(/'([^']+)'/g)].map(
        ([, value]) => value,
      )
    : [];
};

describe("close_tasks migration", () => {
  it("has exactly one close_tasks migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates public.close_tasks with a UUID primary key", () => {
    expect(normalizedSql).toContain(
      "create table public.close_tasks",
    );
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each close task to one organization with cascading delete", () => {
    expect(
      hasColumnDefinition("organization_id", "uuid not null"),
    ).toBe(true);

    expect(normalizedSql).toContain(
      "constraint close_tasks_organization_id_fkey",
    );

    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each close task to one close session with cascading delete", () => {
    expect(
      hasColumnDefinition("close_session_id", "uuid not null"),
    ).toBe(true);

    expect(normalizedSql).toContain(
      "constraint close_tasks_close_session_id_fkey",
    );

    expect(normalizedSql).toContain(
      "foreign key (close_session_id) references public.close_sessions(id) on delete cascade",
    );
  });

  it("restricts task_type to exactly the approved values", () => {
    expect(
      hasColumnDefinition("task_type", "text not null"),
    ).toBe(true);

    expect(
      getConstraintValues(
        "close_tasks_task_type_valid",
        "task_type",
      ),
    ).toEqual([
      "reconciliation",
      "transaction_review",
      "exception_review",
      "giving_review",
      "bill_review",
      "expense_review",
      "journal_review",
      "compliance_review",
      "fund_review",
      "accrual_review",
    ]);
  });

  it("requires a title and allows an optional description", () => {
    expect(
      hasColumnDefinition("title", "text not null"),
    ).toBe(true);

    expect(
      hasColumnDefinition("description", "text"),
    ).toBe(true);
  });

  it("restricts status to exactly the approved values", () => {
    expect(
      hasColumnDefinition(
        "status",
        "text not null default 'pending'",
      ),
    ).toBe(true);

    expect(
      getConstraintValues(
        "close_tasks_status_valid",
        "status",
      ),
    ).toEqual([
      "pending",
      "in_progress",
      "completed",
      "skipped",
    ]);
  });

  it("stores optional due and completion timestamps", () => {
    expect(
      hasColumnDefinition("due_at", "timestamptz"),
    ).toBe(true);

    expect(
      hasColumnDefinition("completed_at", "timestamptz"),
    ).toBe(true);
  });

  it("only allows completed_at when status is completed", () => {
    expect(normalizedSql).toContain(
      "constraint close_tasks_completion_time_valid",
    );

    expect(normalizedSql).toContain(
      "check ( completed_at is null or status = 'completed' )",
    );
  });

  it("uses a nonnegative sort order with default zero", () => {
    expect(
      hasColumnDefinition(
        "sort_order",
        "integer not null default 0",
      ),
    ).toBe(true);

    expect(normalizedSql).toContain(
      "constraint close_tasks_sort_order_nonnegative",
    );

    expect(normalizedSql).toContain(
      "check ( sort_order >= 0 )",
    );
  });

  it("does not add prohibited uniqueness rules", () => {
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*close_session_id\s*,\s*task_type\s*\)/,
    );

    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*task_type\s*,\s*close_session_id\s*\)/,
    );

    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*close_session_id\s*,\s*title\s*\)/,
    );

    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*title\s*,\s*close_session_id\s*\)/,
    );

    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*close_session_id\s*,\s*sort_order\s*\)/,
    );

    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*sort_order\s*,\s*close_session_id\s*\)/,
    );
  });

  it("does not include task dependency fields", () => {
    for (const column of [
      "parent_task_id",
      "depends_on_task_id",
      "prerequisite_task_id",
      "blocked_by_task_id",
    ]) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include user assignment or auth references", () => {
    for (const column of [
      "assigned_to_user_id",
      "owner_user_id",
      "completed_by_user_id",
      "reviewed_by_user_id",
      "approved_by_user_id",
    ]) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include AI or readiness fields", () => {
    for (const column of [
      "ai_generated",
      "ai_score",
      "confidence_score",
      "readiness_score",
      "ai_summary",
      "ai_recommendation",
      "model",
      "model_version",
    ]) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include domain-linking fields", () => {
    for (const column of [
      "reconciliation_id",
      "bank_transaction_id",
      "exception_id",
      "giving_transaction_id",
      "bill_id",
      "expense_id",
      "journal_entry_id",
      "compliance_item_id",
      "fund_id",
      "account_id",
      "source_type",
      "source_id",
    ]) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include evidence, approval, or audit fields", () => {
    for (const column of [
      "audit_document_id",
      "document_id",
      "evidence_id",
      "attachment_url",
      "approval_status",
      "approved_at",
      "reviewer_notes",
      "audit_event_id",
    ]) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("records creation and update timestamps", () => {
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

  it("enables RLS without policies, indexes, triggers, or functions", () => {
    expect(normalizedSql).toContain(
      "alter table public.close_tasks enable row level security",
    );

    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("create index");
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
  });

  it("does not alter the existing close_sessions table", () => {
    expect(normalizedSql).not.toContain(
      "alter table public.close_sessions",
    );
  });

  it("does not create future close workflow tables", () => {
    for (const table of [
      "close_task_templates",
      "close_task_dependencies",
      "close_approvals",
      "close_task_comments",
      "ai_close_tasks",
    ]) {
      expect(createsTableNamed(table)).toBe(false);
    }
  });
});
