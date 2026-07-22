import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_audit_documents.sql"),
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

describe("audit_documents migration", () => {
  it("has exactly one audit_documents migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.audit_documents table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.audit_documents");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each audit document to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint audit_documents_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("optionally links each audit document to an audit event while preserving document metadata", () => {
    expect(hasColumnDefinition("audit_event_id", "uuid")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*audit_event_id\s+uuid\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint audit_documents_audit_event_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (audit_event_id) references public.audit_events(id) on delete set null",
    );
  });

  it("requires a nonblank name without uniqueness constraints", () => {
    expect(hasColumnDefinition("name", "text not null")).toBe(true);
    expect(normalizedSql).toContain("constraint audit_documents_name_not_blank");
    expect(normalizedSql).toContain("check (char_length(btrim(name)) > 0)");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*name\s*\)/);
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*organization_id\s*,\s*name\s*\)/,
    );
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*name\s*,\s*organization_id\s*\)/,
    );
    expect(hasColumnNamed("slug")).toBe(false);
    expect(hasColumnNamed("document_number")).toBe(false);
    expect(hasColumnNamed("external_id")).toBe(false);
  });

  it("restricts document_type to the approved broad classifications", () => {
    expect(
      hasColumnDefinition("document_type", "text not null default 'other'"),
    ).toBe(true);
    expect(
      getConstraintValues("audit_documents_document_type_valid", "document_type"),
    ).toEqual([
      "financial",
      "banking",
      "giving",
      "compliance",
      "governance",
      "exception",
      "other",
    ]);

    const fineGrainedTypes = [
      "invoice",
      "receipt",
      "statement",
      "contract",
      "policy",
    ];

    for (const type of fineGrainedTypes) {
      expect(normalizedSql).not.toContain(`'${type}'`);
    }
  });

  it("allows nullable document dates without defaults or lifecycle timestamps", () => {
    expect(hasColumnDefinition("document_date", "date")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*document_date\s+date\s+not\s+null\b/,
    );
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*document_date\s+date(?:\s+not\s+null)?\s+default\b/,
    );

    const lifecycleTimestampColumns = [
      "uploaded_at",
      "received_at",
      "signed_at",
      "verified_at",
      "expiration_date",
    ];

    for (const column of lifecycleTimestampColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("allows nullable nonblank descriptions without notes or AI summaries", () => {
    expect(hasColumnDefinition("description", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*description\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint audit_documents_description_not_blank",
    );
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");
    expect(hasColumnNamed("notes")).toBe(false);
    expect(hasColumnNamed("internal_notes")).toBe(false);
    expect(hasColumnNamed("ai_summary")).toBe(false);
  });

  it("restricts status to active or archived", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'active'"),
    ).toBe(true);
    expect(getConstraintValues("audit_documents_status_valid", "status"))
      .toEqual(["active", "archived"]);

    const excludedStatuses = [
      "deleted",
      "expired",
      "pending",
      "quarantined",
      "verified",
    ];

    for (const status of excludedStatuses) {
      expect(normalizedSql).not.toContain(`'${status}'`);
    }
  });

  it("does not include actual file-storage columns", () => {
    const fileStorageColumns = [
      "file_url",
      "storage_path",
      "bucket_name",
      "object_key",
      "signed_url",
      "download_url",
    ];

    for (const column of fileStorageColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include physical-file metadata columns", () => {
    const physicalFileMetadataColumns = [
      "original_filename",
      "mime_type",
      "file_size",
      "extension",
    ];

    for (const column of physicalFileMetadataColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include cryptographic integrity columns", () => {
    const cryptographicColumns = [
      "hash",
      "file_hash",
      "checksum",
      "signature",
      "previous_hash",
    ];

    for (const column of cryptographicColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include retention or legal-hold columns", () => {
    const retentionLegalHoldColumns = [
      "retention_until",
      "retention_policy_id",
      "legal_hold",
      "legal_hold_at",
      "locked_at",
      "immutable_until",
    ];

    for (const column of retentionLegalHoldColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include versioning columns", () => {
    const versioningColumns = [
      "version",
      "previous_version_id",
      "superseded_by_id",
    ];

    for (const column of versioningColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include user-attribution columns or auth users references", () => {
    const userAttributionColumns = [
      "uploaded_by",
      "uploaded_by_user_id",
      "created_by_user_id",
      "archived_by_user_id",
    ];

    for (const column of userAttributionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include access or security classification columns", () => {
    const accessSecurityColumns = [
      "visibility",
      "access_level",
      "permission_group",
      "confidential",
      "restricted",
    ];

    for (const column of accessSecurityColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include OCR or AI columns", () => {
    const ocrAiColumns = [
      "ocr_text",
      "extracted_text",
      "ai_summary",
      "ai_classification",
      "ai_score",
      "model",
      "model_version",
    ];

    for (const column of ocrAiColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include malware scanning or quarantine columns", () => {
    const scanningQuarantineColumns = [
      "scan_status",
      "scanned_at",
      "malware_detected",
      "quarantine_status",
    ];

    for (const column of scanningQuarantineColumns) {
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

  it("enables RLS without creating policies", () => {
    expect(normalizedSql).toContain(
      "alter table public.audit_documents enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not create future audit-document infrastructure or unrelated domain tables", () => {
    const futureDomainTables = [
      "audit_document_versions",
      "audit_document_retention",
      "audit_legal_holds",
      "audit_document_hashes",
      "audit_document_signatures",
      "audit_document_access",
      "audit_document_ocr",
      "ai_document_reviews",
      "malware_scans",
      "storage_objects",
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
