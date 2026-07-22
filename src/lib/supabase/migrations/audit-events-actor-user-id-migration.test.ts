import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260720180000_add_audit_events_actor_user_id.sql",
);
const rowsTypePath = join(process.cwd(), "src/lib/data/types/rows.ts");
const migrationSql = readFileSync(migrationPath, "utf8");
const rowsTypeSource = readFileSync(rowsTypePath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("audit events actor_user_id migration", () => {
  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain(
      "20260720180000_add_audit_events_actor_user_id.sql",
    );
  });

  it("adds actor_user_id as a nullable column without a default", () => {
    expectMigrationToMatch(
      /alter table public\.audit_events add column actor_user_id uuid null/,
    );
    expect(normalizedSql).not.toMatch(
      /actor_user_id uuid null default/,
    );
    expect(normalizedSql).not.toMatch(
      /actor_user_id uuid not null/,
    );
  });

  it("adds the auth.users foreign key with ON DELETE SET NULL", () => {
    expect(normalizedSql).toContain(
      "constraint audit_events_actor_user_id_fkey",
    );
    expectMigrationToMatch(
      /foreign key \(actor_user_id\) references auth\.users\(id\) on delete set null/,
    );
  });

  it("documents user, system/integration, and legacy nullability expectations", () => {
    expect(migrationSql).toContain("comment on column public.audit_events.actor_user_id is");
    expect(migrationSql).toContain("actor_type = ''user''");
    expect(migrationSql).toContain("system/integration");
    expect(migrationSql).toContain("legacy user rows");
  });

  it("does not add a CHECK requiring actor_user_id for actor_type = user", () => {
    expect(normalizedSql).not.toMatch(
      /actor_type\s*<>\s*'user'\s*or\s*actor_user_id\s+is\s+not\s+null/,
    );
    expect(normalizedSql).not.toMatch(
      /actor_type\s*=\s*'user'\s*and\s*actor_user_id\s+is\s+not\s+null/,
    );
    expect(normalizedSql).not.toMatch(
      /check \(.*actor_user_id.*actor_type/,
    );
  });

  it("updates the RPC audit insert to include actor_user_id = auth.uid()", () => {
    expectMigrationToMatch(
      /insert into public\.audit_events \( organization_id, event_type, source_type, source_id, actor_type, actor_user_id, description, occurred_at \)/,
    );
    expectMigrationToMatch(
      /values \( target_organization_id, 'compliance\.status_updated', 'compliance_item', target_item_id, 'user', auth\.uid\(\), format\(/,
    );
  });

  it("preserves SECURITY DEFINER and hardened search_path on the RPC", () => {
    expectMigrationToMatch(
      /create or replace function public\.update_compliance_item_status\( target_organization_id uuid, target_item_id uuid, next_status text \)/,
    );
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("does not add write RLS policies", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/for insert to authenticated/);
    expect(normalizedSql).not.toMatch(/for update to authenticated/);
    expect(normalizedSql).not.toMatch(/for delete to authenticated/);
  });

  it("preserves RPC grant and revoke posture", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.update_compliance_item_status(uuid, uuid, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.update_compliance_item_status(uuid, uuid, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.update_compliance_item_status(uuid, uuid, text) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.update_compliance_item_status\(uuid, uuid, text\) to anon/,
    );
  });
});

describe("AuditEventRow type", () => {
  it("represents actor_user_id as string | null", () => {
    expect(rowsTypeSource).toMatch(
      /actor_user_id:\s*string\s*\|\s*null/,
    );
  });
});
