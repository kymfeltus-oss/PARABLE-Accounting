import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_compliance_items.sql"),
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

  return match ? [...match[1].matchAll(/'([^']+)'/g)].map(([, value]) => value) : [];
};

describe("compliance_items migration", () => {
  it("has exactly one compliance_items migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.compliance_items table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.compliance_items");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each compliance item to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint compliance_items_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("requires a nonblank name without uniqueness constraints", () => {
    expect(hasColumnDefinition("name", "text not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint compliance_items_name_not_blank",
    );
    expect(normalizedSql).toContain("check (char_length(btrim(name)) > 0)");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*name\s*\)/);
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*organization_id\s*,\s*name\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*name\s*,\s*organization_id\s*\)/,
    );
    expect(hasColumnNamed("code")).toBe(false);
    expect(hasColumnNamed("slug")).toBe(false);
    expect(hasColumnNamed("external_id")).toBe(false);
  });

  it("restricts category to the approved broad classifications", () => {
    expect(
      hasColumnDefinition("category", "text not null default 'other'"),
    ).toBe(true);
    expect(getConstraintValues("compliance_items_category_valid", "category"))
      .toEqual([
        "federal_tax",
        "state_tax",
        "payroll",
        "charity_registration",
        "governance",
        "policy",
        "other",
      ]);
  });

  it("allows nullable due dates without defaults or filing date columns", () => {
    expect(hasColumnDefinition("due_date", "date")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*due_date\s+date\s+not\s+null\b/,
    );
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*due_date\s+date(?:\s+not\s+null)?\s+default\b/,
    );

    const filingDateColumns = [
      "filed_date",
      "completed_date",
      "submitted_date",
      "reminder_date",
      "next_due_date",
    ];

    for (const column of filingDateColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("restricts status to open, completed, or not_applicable without storing overdue", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'open'"),
    ).toBe(true);
    expect(getConstraintValues("compliance_items_status_valid", "status"))
      .toEqual(["open", "completed", "not_applicable"]);
    expect(normalizedSql).not.toContain("'overdue'");
    expect(normalizedSql).not.toContain("'pending'");
    expect(normalizedSql).not.toContain("'filed'");
    expect(normalizedSql).not.toContain("'rejected'");
    expect(normalizedSql).not.toContain("'approved'");
    expect(normalizedSql).not.toContain("'waived'");
  });

  it("allows nullable nonblank descriptions", () => {
    expect(hasColumnDefinition("description", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*description\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint compliance_items_description_not_blank",
    );
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
    expect(hasColumnNamed("notes")).toBe(false);
    expect(hasColumnNamed("internal_notes")).toBe(false);
    expect(hasColumnNamed("instructions")).toBe(false);
  });

  it("does not include jurisdiction columns", () => {
    const jurisdictionColumns = [
      "country",
      "state",
      "jurisdiction",
      "jurisdiction_code",
    ];

    for (const column of jurisdictionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include form or filing identifier columns", () => {
    const filingIdentifierColumns = [
      "form_number",
      "form_name",
      "filing_id",
      "submission_id",
      "confirmation_number",
    ];

    for (const column of filingIdentifierColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include document or evidence columns", () => {
    const documentEvidenceColumns = [
      "document_id",
      "attachment_id",
      "evidence_id",
      "file_url",
      "storage_path",
    ];

    for (const column of documentEvidenceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include assignment or owner columns", () => {
    const assignmentColumns = [
      "assigned_to",
      "assigned_to_user_id",
      "owner_user_id",
      "responsible_user_id",
    ];

    for (const column of assignmentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include approval or review columns", () => {
    const approvalReviewColumns = [
      "approved_by",
      "reviewed_by",
      "reviewed_at",
      "approval_status",
    ];

    for (const column of approvalReviewColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include reminder or notification columns", () => {
    const reminderNotificationColumns = [
      "reminder_at",
      "reminder_days_before",
      "notification_status",
      "last_notified_at",
    ];

    for (const column of reminderNotificationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include recurrence columns", () => {
    const recurrenceColumns = [
      "recurrence_rule",
      "recurrence_frequency",
      "recurrence_interval",
      "next_due_date",
    ];

    for (const column of recurrenceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include AI or risk columns", () => {
    const aiRiskColumns = [
      "ai_score",
      "risk_score",
      "confidence_score",
      "ai_summary",
      "ai_status",
    ];

    for (const column of aiRiskColumns) {
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
      "alter table public.compliance_items enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not create future compliance or unrelated domain tables", () => {
    const futureDomainTables = [
      "compliance_filings",
      "compliance_documents",
      "compliance_evidence",
      "compliance_reminders",
      "notifications",
      "recurring_compliance",
      "ai_compliance_reviews",
      "audit_events",
      "audit_logs",
      "tax_statements",
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
