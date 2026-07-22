import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_audit_events.sql"),
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

describe("audit_events migration", () => {
  it("has exactly one audit_events migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.audit_events table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.audit_events");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each audit event to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint audit_events_organization_id_fkey",
    );
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("requires a nonblank event_type without restricting it to a fixed event list", () => {
    expect(hasColumnDefinition("event_type", "text not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint audit_events_event_type_not_blank",
    );
    expect(normalizedSql).toContain(
      "check (char_length(btrim(event_type)) > 0)",
    );
    expect(normalizedSql).not.toContain("event_type in (");
    expect(normalizedSql).not.toContain("constraint audit_events_event_type_valid");
  });

  it("requires a nonblank source_type without restricting it to a fixed source list", () => {
    expect(hasColumnDefinition("source_type", "text not null")).toBe(true);
    expect(normalizedSql).toContain(
      "constraint audit_events_source_type_not_blank",
    );
    expect(normalizedSql).toContain(
      "check (char_length(btrim(source_type)) > 0)",
    );
    expect(normalizedSql).not.toContain("source_type in (");
    expect(normalizedSql).not.toContain(
      "constraint audit_events_source_type_valid",
    );
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

  it("restricts actor_type to broad actor categories without actor identity columns", () => {
    expect(
      hasColumnDefinition("actor_type", "text not null default 'system'"),
    ).toBe(true);
    expect(getConstraintValues("audit_events_actor_type_valid", "actor_type"))
      .toEqual(["system", "user", "integration"]);

    const actorIdentityColumns = [
      "user_id",
      "actor_user_id",
      "integration_id",
      "service_account_id",
    ];

    for (const column of actorIdentityColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("allows nullable nonblank descriptions without payload or context columns", () => {
    expect(hasColumnDefinition("description", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*description\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain(
      "constraint audit_events_description_not_blank",
    );
    expect(normalizedSql).toContain("description is null");
    expect(normalizedSql).toContain("char_length(btrim(description)) > 0");

    const extraDescriptionColumns = [
      "notes",
      "reason",
      "metadata",
      "payload",
      "context",
    ];

    for (const column of extraDescriptionColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("records event timing and creation timestamps without updated_at", () => {
    expect(
      hasColumnDefinition(
        "occurred_at",
        "timestamptz not null default now\\(\\)",
      ),
    ).toBe(true);
    expect(
      hasColumnDefinition(
        "created_at",
        "timestamptz not null default now\\(\\)",
      ),
    ).toBe(true);
    expect(hasColumnNamed("updated_at")).toBe(false);
  });

  it("does not reference auth users", () => {
    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include before, after, payload, metadata, context, or JSON columns", () => {
    const snapshotColumns = [
      "before_data",
      "after_data",
      "old_values",
      "new_values",
      "changes",
      "payload",
      "metadata",
      "context",
    ];

    for (const column of snapshotColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toMatch(/\bjsonb?\b/);
  });

  it("does not include cryptographic integrity columns", () => {
    const cryptographicColumns = [
      "hash",
      "event_hash",
      "previous_hash",
      "signature",
      "checksum",
    ];

    for (const column of cryptographicColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include document or evidence columns", () => {
    const documentEvidenceColumns = [
      "document_id",
      "evidence_id",
      "attachment_id",
      "file_url",
      "storage_path",
    ];

    for (const column of documentEvidenceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include network, device, or session columns", () => {
    const networkDeviceColumns = [
      "ip_address",
      "user_agent",
      "device_id",
      "session_id",
    ];

    for (const column of networkDeviceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include AI provenance columns", () => {
    const aiProvenanceColumns = [
      "ai_generated",
      "model",
      "model_version",
      "prompt_version",
      "confidence_score",
      "ai_reason",
    ];

    for (const column of aiProvenanceColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include external logging columns", () => {
    const externalLoggingColumns = [
      "external_log_id",
      "siem_id",
      "webhook_id",
      "export_status",
    ];

    for (const column of externalLoggingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("enables RLS without policies, triggers, functions, or update/delete protection", () => {
    expect(normalizedSql).toContain(
      "alter table public.audit_events enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
    expect(normalizedSql).not.toContain("create trigger");
    expect(normalizedSql).not.toContain("create function");
    expect(normalizedSql).not.toContain("for update");
    expect(normalizedSql).not.toContain("for delete");
    expect(normalizedSql).not.toContain("instead of update");
    expect(normalizedSql).not.toContain("instead of delete");
  });

  it("does not create future audit infrastructure or unrelated domain tables", () => {
    const futureDomainTables = [
      "audit_documents",
      "audit_evidence",
      "audit_hash_chain",
      "audit_signatures",
      "audit_actors",
      "audit_sessions",
      "ai_audit_provenance",
      "external_audit_logs",
      "notifications",
      "reconciliations",
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
