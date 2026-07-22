import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_bank_transaction_matches.sql"),
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

describe("bank_transaction_matches migration", () => {
  it("has exactly one bank_transaction_matches migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.bank_transaction_matches table with a UUID primary key", () => {
    expect(normalizedSql).toContain(
      "create table public.bank_transaction_matches",
    );
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each bank transaction match to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bank_transaction_matches_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("links each match to one bank transaction with cascading delete", () => {
    expect(
      hasColumnDefinition("bank_transaction_id", "uuid not null"),
    ).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bank_transaction_matches_bank_transaction_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (bank_transaction_id) references public.bank_transactions(id) on delete cascade",
    );
  });

  it("restricts source_type to the approved accounting-domain sources", () => {
    expect(hasColumnDefinition("source_type", "text not null")).toBe(true);
    expect(
      getConstraintValues("bank_transaction_matches_source_type_valid", "source_type"),
    ).toEqual([
      "bill_payment",
      "expense",
      "giving_transaction",
      "journal_entry",
    ]);

    const excludedSourceTypes = [
      "bill",
      "vendor",
      "member",
      "fund",
      "account",
      "reconciliation",
      "reconciliation_item",
    ];

    for (const sourceType of excludedSourceTypes) {
      expect(normalizedSql).not.toContain(`'${sourceType}'`);
    }
  });

  it("requires a polymorphic source_id without source-specific foreign keys", () => {
    expect(hasColumnDefinition("source_id", "uuid not null")).toBe(true);
    expect(normalizedSql).not.toContain("foreign key (source_id)");

    const sourceSpecificColumns = [
      "bill_payment_id",
      "expense_id",
      "giving_transaction_id",
      "journal_entry_id",
    ];

    for (const column of sourceSpecificColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("stores a positive matched_amount without floating-point financial types", () => {
    expect(
      hasColumnDefinition("matched_amount", "numeric\\(18,2\\) not null"),
    ).toBe(true);
    expect(normalizedSql).toContain(
      "constraint bank_transaction_matches_amount_positive",
    );
    expect(normalizedSql).toContain("check (matched_amount > 0)");
    expect(normalizedSql).not.toContain("real");
    expect(normalizedSql).not.toContain("double precision");
  });

  it("prevents duplicate source matches for the same bank transaction without broader uniqueness", () => {
    expect(normalizedSql).toContain(
      "constraint bank_transaction_matches_source_unique unique ( bank_transaction_id, source_type, source_id )",
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*bank_transaction_id\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*source_type\s*,\s*source_id\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*source_id\s*,\s*source_type\s*\)/,
    );
  });

  it("restricts status to proposed, confirmed, and rejected", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'proposed'"),
    ).toBe(true);
    expect(getConstraintValues("bank_transaction_matches_status_valid", "status"))
      .toEqual(["proposed", "confirmed", "rejected"]);

    const excludedStatuses = [
      "pending",
      "matched",
      "unmatched",
      "auto_matched",
      "posted",
      "voided",
    ];

    for (const status of excludedStatuses) {
      expect(normalizedSql).not.toContain(`'${status}'`);
    }
  });

  it("does not include reconciliation relationship columns", () => {
    const reconciliationColumns = [
      "reconciliation_id",
      "reconciliation_item_id",
    ];

    for (const column of reconciliationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include user attribution columns or auth users references", () => {
    const userAttributionColumns = [
      "proposed_by_user_id",
      "confirmed_by_user_id",
      "rejected_by_user_id",
      "reviewed_by_user_id",
      "approved_by_user_id",
    ];

    for (const column of userAttributionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include match provenance or AI columns", () => {
    const provenanceAiColumns = [
      "match_method",
      "match_rule",
      "confidence_score",
      "match_score",
      "ai_score",
      "ai_generated",
      "model",
      "model_version",
    ];

    for (const column of provenanceAiColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include workflow metadata columns", () => {
    const workflowMetadataColumns = [
      "rejection_reason",
      "review_notes",
      "confirmed_at",
      "rejected_at",
    ];

    for (const column of workflowMetadataColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include posting columns", () => {
    const postingColumns = [
      "posting_status",
      "generated_journal_entry_id",
      "journal_entry_line_id",
    ];

    for (const column of postingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include exception or audit relationship columns", () => {
    const exceptionAuditColumns = ["exception_id", "audit_event_id"];

    for (const column of exceptionAuditColumns) {
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
      "alter table public.bank_transaction_matches enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("create index");
  });

  it("does not alter existing bank transaction or reconciliation item tables", () => {
    expect(normalizedSql).not.toContain("alter table public.bank_transactions");
    expect(normalizedSql).not.toContain("alter table public.reconciliation_items");
  });

  it("does not create future matching workflow or source-specific tables", () => {
    const futureDomainTables = [
      "ai_transaction_matches",
      "transaction_match_suggestions",
      "bill_payment_matches",
      "expense_matches",
      "giving_transaction_matches",
      "journal_entry_matches",
      "match_approvals",
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
