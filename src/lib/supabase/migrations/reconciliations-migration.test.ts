import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_reconciliations.sql"),
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

describe("reconciliations migration", () => {
  it("has exactly one reconciliations migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.reconciliations table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.reconciliations");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each reconciliation to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint reconciliations_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each reconciliation to one bank account with restricted delete", () => {
    expect(hasColumnDefinition("bank_account_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint reconciliations_bank_account_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (bank_account_id) references public.bank_accounts(id) on delete restrict",
    );
  });

  it("requires a valid reconciliation period", () => {
    expect(hasColumnDefinition("period_start", "date not null")).toBe(true);
    expect(hasColumnDefinition("period_end", "date not null")).toBe(true);
    expect(normalizedSql).toContain("constraint reconciliations_period_valid");
    expect(normalizedSql).toContain("check (period_end >= period_start)");

    const statementLifecycleDateColumns = [
      "statement_date",
      "completed_date",
      "locked_date",
      "closed_date",
    ];

    for (const column of statementLifecycleDateColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("stores a statement ending balance without positivity constraints or floating-point types", () => {
    expect(
      hasColumnDefinition(
        "statement_ending_balance",
        "numeric\\(18,2\\) not null",
      ),
    ).toBe(true);
    expect(normalizedSql).not.toContain("statement_ending_balance > 0");
    expect(normalizedSql).not.toContain("statement_ending_balance >= 0");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("restricts status to draft, in_progress, and completed", () => {
    expect(hasColumnDefinition("status", "text not null default 'draft'")).toBe(
      true,
    );
    expect(getConstraintValues("reconciliations_status_valid", "status"))
      .toEqual(["draft", "in_progress", "completed"]);

    const excludedStatuses = ["locked", "approved", "void", "reopened"];

    for (const status of excludedStatuses) {
      expect(normalizedSql).not.toContain(`'${status}'`);
    }
  });

  it("does not include derived or calculated balance columns", () => {
    const derivedBalanceColumns = [
      "statement_beginning_balance",
      "book_balance",
      "reconciled_balance",
      "difference",
      "adjustment_total",
    ];

    for (const column of derivedBalanceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include transaction-match columns", () => {
    const transactionMatchColumns = [
      "bank_transaction_id",
      "matched_transaction_id",
      "source_id",
      "source_type",
      "journal_entry_id",
    ];

    for (const column of transactionMatchColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include cleared or outstanding tracking columns", () => {
    const clearedOutstandingColumns = [
      "cleared",
      "cleared_at",
      "outstanding",
      "outstanding_type",
    ];

    for (const column of clearedOutstandingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include adjustment columns", () => {
    const adjustmentColumns = [
      "adjustment_amount",
      "adjustment_account_id",
      "adjustment_journal_entry_id",
    ];

    for (const column of adjustmentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include user assignment or approval columns or auth users references", () => {
    const assignmentApprovalColumns = [
      "assigned_to_user_id",
      "prepared_by_user_id",
      "reviewed_by_user_id",
      "approved_by_user_id",
    ];

    for (const column of assignmentApprovalColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include document or evidence columns", () => {
    const documentEvidenceColumns = [
      "document_id",
      "audit_document_id",
      "statement_document_id",
      "file_url",
      "storage_path",
    ];

    for (const column of documentEvidenceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include AI or automation columns", () => {
    const aiAutomationColumns = [
      "ai_status",
      "ai_score",
      "confidence_score",
      "auto_matched",
      "auto_completed",
    ];

    for (const column of aiAutomationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include exception or audit relationship columns", () => {
    const exceptionAuditColumns = ["exception_id", "audit_event_id"];

    for (const column of exceptionAuditColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not add a bank-account and period uniqueness constraint", () => {
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*bank_account_id\s*,\s*period_start\s*,\s*period_end\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*bank_account_id\s*,\s*period_end\s*,\s*period_start\s*\)/,
    );
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
      "alter table public.reconciliations enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("create index");
  });

  it("does not create future reconciliation infrastructure or unrelated domain tables", () => {
    const futureDomainTables = [
      "bank_transaction_matches",
      "reconciliation_matches",
      "reconciliation_items",
      "outstanding_checks",
      "deposits_in_transit",
      "reconciliation_adjustments",
      "reconciliation_approvals",
      "ai_reconciliation_matches",
    ];

    for (const table of futureDomainTables) {
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
