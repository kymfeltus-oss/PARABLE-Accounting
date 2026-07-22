import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_reconciliation_items.sql"),
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

describe("reconciliation_items migration", () => {
  it("has exactly one reconciliation_items migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.reconciliation_items table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.reconciliation_items");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each reconciliation item to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint reconciliation_items_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each reconciliation item to one reconciliation with cascading delete", () => {
    expect(hasColumnDefinition("reconciliation_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint reconciliation_items_reconciliation_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (reconciliation_id) references public.reconciliations(id) on delete cascade",
    );
  });

  it("links each reconciliation item to one bank transaction with restricted delete", () => {
    expect(
      hasColumnDefinition("bank_transaction_id", "uuid not null"),
    ).toBe(true);
    expect(normalizedSql).toContain(
      "constraint reconciliation_items_bank_transaction_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (bank_transaction_id) references public.bank_transactions(id) on delete restrict",
    );
  });

  it("prevents a bank transaction from appearing twice in the same reconciliation", () => {
    expect(normalizedSql).toContain(
      "constraint reconciliation_items_reconciliation_transaction_unique unique (reconciliation_id, bank_transaction_id)",
    );
  });

  it("restricts status to pending, cleared, and excluded", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'pending'"),
    ).toBe(true);
    expect(getConstraintValues("reconciliation_items_status_valid", "status"))
      .toEqual(["pending", "cleared", "excluded"]);

    const excludedStatuses = [
      "matched",
      "unmatched",
      "proposed",
      "approved",
      "rejected",
      "adjusted",
    ];

    for (const status of excludedStatuses) {
      expect(normalizedSql).not.toContain(`'${status}'`);
    }
  });

  it("does not include cross-domain source matching columns", () => {
    const crossDomainColumns = [
      "source_type",
      "source_id",
      "bill_id",
      "bill_payment_id",
      "expense_id",
      "giving_transaction_id",
      "journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of crossDomainColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include match provenance or confidence columns", () => {
    const matchProvenanceColumns = [
      "match_type",
      "matched_by",
      "matched_by_user_id",
      "matched_at",
      "confidence_score",
      "match_score",
      "ai_score",
      "auto_matched",
    ];

    for (const column of matchProvenanceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include clearing date columns", () => {
    const clearingDateColumns = ["cleared_at", "cleared_date"];

    for (const column of clearingDateColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not duplicate financial amount columns", () => {
    const financialAmountColumns = [
      "amount",
      "debit",
      "credit",
      "cleared_amount",
      "adjustment_amount",
    ];

    for (const column of financialAmountColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include adjustment relationship columns", () => {
    const adjustmentColumns = [
      "adjustment_id",
      "adjustment_account_id",
      "adjustment_journal_entry_id",
    ];

    for (const column of adjustmentColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include outstanding item columns", () => {
    const outstandingItemColumns = [
      "outstanding_type",
      "check_number",
      "deposit_batch_id",
    ];

    for (const column of outstandingItemColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include user assignment or approval columns or auth users references", () => {
    const assignmentApprovalColumns = [
      "reviewed_by_user_id",
      "cleared_by_user_id",
      "excluded_by_user_id",
      "approved_by_user_id",
    ];

    for (const column of assignmentApprovalColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include exclusion-justification columns", () => {
    const exclusionJustificationColumns = [
      "exclusion_reason",
      "exclusion_notes",
    ];

    for (const column of exclusionJustificationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include exception or audit relationship columns", () => {
    const exceptionAuditColumns = ["exception_id", "audit_event_id"];

    for (const column of exceptionAuditColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include AI or automation columns", () => {
    const aiAutomationColumns = [
      "ai_status",
      "ai_score",
      "confidence_score",
      "suggested_status",
      "auto_cleared",
    ];

    for (const column of aiAutomationColumns) {
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

  it("enables RLS without policies or additional indexes", () => {
    expect(normalizedSql).toContain(
      "alter table public.reconciliation_items enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("create index");
  });

  it("does not create future reconciliation matching or workflow tables", () => {
    const futureDomainTables = [
      "transaction_matches",
      "bank_transaction_matches",
      "reconciliation_adjustments",
      "outstanding_checks",
      "deposits_in_transit",
      "reconciliation_approvals",
      "ai_reconciliation_matches",
      "reconciliation_exceptions",
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
