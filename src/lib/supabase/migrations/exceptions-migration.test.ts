import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_exceptions.sql"),
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

describe("exceptions migration", () => {
  it("has exactly one exceptions migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.exceptions table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.exceptions");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each exception to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint exceptions_organization_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("requires a nonblank source_type without restricting it to a fixed source list", () => {
    expect(hasColumnDefinition("source_type", "text not null")).toBe(true);
    expect(normalizedSql).toContain("constraint exceptions_source_type_not_blank");
    expect(normalizedSql).toContain(
      "check (char_length(btrim(source_type)) > 0)",
    );
    expect(normalizedSql).not.toContain("source_type in (");
    expect(normalizedSql).not.toContain("constraint exceptions_source_type_valid");
  });

  it("allows nullable source_id without domain-table foreign keys", () => {
    expect(hasColumnDefinition("source_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*source_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).not.toContain("foreign key (source_id)");
    expect(normalizedSql).not.toMatch(
      /source_id\)\s+references\s+public\.[a-z_]+\(id\)/,
    );
  });

  it("restricts category to the approved source domains", () => {
    expect(
      hasColumnDefinition("category", "text not null default 'other'"),
    ).toBe(true);
    expect(getConstraintValues("exceptions_category_valid", "category")).toEqual(
      [
        "accounting",
        "banking",
        "bills",
        "expenses",
        "giving",
        "budgets",
        "compliance",
        "data_quality",
        "other",
      ],
    );
    expect(normalizedSql).not.toContain("'ai_close'");
    expect(normalizedSql).not.toContain("'reconciliation'");
  });

  it("restricts severity to the approved levels", () => {
    expect(
      hasColumnDefinition("severity", "text not null default 'medium'"),
    ).toBe(true);
    expect(getConstraintValues("exceptions_severity_valid", "severity")).toEqual(
      ["low", "medium", "high", "critical"],
    );
  });

  it("requires a nonblank title without generated numbering columns", () => {
    expect(hasColumnDefinition("title", "text not null")).toBe(true);
    expect(normalizedSql).toContain("constraint exceptions_title_not_blank");
    expect(normalizedSql).toContain("check (char_length(btrim(title)) > 0)");
    expect(hasColumnNamed("code")).toBe(false);
    expect(hasColumnNamed("exception_number")).toBe(false);
  });

  it("allows nullable nonblank descriptions without resolution note fields", () => {
    expect(hasColumnDefinition("description", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*description\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint exceptions_description_not_blank",
    );
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
    expect(hasColumnNamed("resolution_notes")).toBe(false);
    expect(hasColumnNamed("dismissal_reason")).toBe(false);
    expect(hasColumnNamed("internal_notes")).toBe(false);
  });

  it("restricts status to open, resolved, or dismissed without workflow states", () => {
    expect(hasColumnDefinition("status", "text not null default 'open'")).toBe(
      true,
    );
    expect(getConstraintValues("exceptions_status_valid", "status")).toEqual([
      "open",
      "resolved",
      "dismissed",
    ]);

    const workflowStates = [
      "in_progress",
      "assigned",
      "escalated",
      "snoozed",
      "ignored",
    ];

    for (const state of workflowStates) {
      expect(normalizedSql).not.toContain(`'${state}'`);
    }
  });

  it("does not include assignment or ownership columns", () => {
    const assignmentColumns = [
      "assigned_to",
      "assigned_to_user_id",
      "owner_user_id",
      "resolved_by_user_id",
      "dismissed_by_user_id",
    ];

    for (const column of assignmentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include resolution or dismissal metadata columns", () => {
    const resolutionColumns = [
      "resolved_at",
      "dismissed_at",
      "resolution_notes",
      "dismissal_reason",
    ];

    for (const column of resolutionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include comment or collaboration columns", () => {
    const commentColumns = ["comment_count", "last_comment_at"];

    for (const column of commentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include evidence or attachment columns", () => {
    const evidenceAttachmentColumns = [
      "attachment_id",
      "document_id",
      "evidence_id",
      "file_url",
      "storage_path",
    ];

    for (const column of evidenceAttachmentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include AI columns", () => {
    const aiColumns = [
      "ai_generated",
      "ai_summary",
      "ai_reason",
      "ai_score",
      "confidence_score",
      "model",
      "prompt_version",
    ];

    for (const column of aiColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include reconciliation or posting relationship columns", () => {
    const reconciliationPostingColumns = [
      "bank_transaction_id",
      "reconciliation_id",
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of reconciliationPostingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include audit relationship columns", () => {
    const auditColumns = [
      "audit_event_id",
      "audit_log_id",
      "audit_vault_id",
    ];

    for (const column of auditColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include SLA, due-date, reminder, or escalation columns", () => {
    const slaEscalationColumns = [
      "due_date",
      "escalation_date",
      "escalated_at",
      "reminder_at",
    ];

    for (const column of slaEscalationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not reference auth users", () => {
    expect(normalizedSql).not.toContain("auth.users");
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

  it("enables RLS without creating policies", () => {
    expect(normalizedSql).toContain(
      "alter table public.exceptions enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not create future exception workflow or unrelated domain tables", () => {
    const futureDomainTables = [
      "exception_comments",
      "exception_documents",
      "exception_evidence",
      "exception_assignments",
      "ai_exception_reviews",
      "reconciliations",
      "audit_events",
      "audit_logs",
      "notifications",
      "reminders",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }
  });

  it("does not add unsupported migration objects", () => {
    expect(normalizedSql).not.toContain("create view");
    expect(normalizedSql).not.toContain("create index");
    expect(normalizedSql).not.toContain("create extension");
    expect(normalizedSql).not.toContain("grant ");
    expect(normalizedSql).not.toContain("insert into");
  });
});
