import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260720181000_create_update_exception_status.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("update exception status RPC migration", () => {
  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain(
      "20260720181000_create_update_exception_status.sql",
    );
  });

  it("creates update_exception_status as SECURITY DEFINER with hardened search_path", () => {
    expectMigrationToMatch(
      /create or replace function public\.update_exception_status\( target_organization_id uuid, target_exception_id uuid, next_status text \)/,
    );
    expectMigrationToMatch(/returns public\.exceptions/);
    expectMigrationToMatch(/language plpgsql/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("rejects unauthenticated callers via auth.uid() guard", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain("raise exception 'authenticated user is required'");
  });

  it("allows only owner, accountant, and staff via has_org_role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
  });

  it("excludes viewer from allowed roles", () => {
    expect(normalizedSql).not.toMatch(/array\['owner', 'accountant', 'staff', 'viewer'\]/);
    expect(normalizedSql).not.toMatch(/array\['viewer'\]/);
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("normalizes and validates the exact allowed status list", () => {
    expect(normalizedSql).toContain("normalized_status := btrim(next_status)");
    expect(normalizedSql).toContain(
      "if normalized_status not in ('open', 'resolved', 'dismissed') then",
    );
    expect(normalizedSql).not.toContain("'completed'");
    expect(normalizedSql).not.toContain("'not_applicable'");
  });

  it("scopes the target exception by id and organization_id with FOR UPDATE", () => {
    expect(normalizedSql).toContain("where id = target_exception_id");
    expect(normalizedSql).toContain("and organization_id = target_organization_id");
    expect(normalizedSql).toContain("for update");
    expect(normalizedSql).toContain(
      "raise exception 'exception not found for organization'",
    );
  });

  it("rejects no-op status changes", () => {
    expect(normalizedSql).toContain(
      "if current_exception.status = normalized_status then",
    );
    expect(normalizedSql).toContain(
      "raise exception 'exception status is already %', normalized_status",
    );
  });

  it("updates only status and updated_at on exceptions", () => {
    expectMigrationToMatch(
      /update public\.exceptions set status = normalized_status, updated_at = now\(\) where id = target_exception_id and organization_id = target_organization_id returning \* into updated_exception/,
    );
  });

  it("appends an exception status audit event with actor_user_id in the same function", () => {
    expect(normalizedSql).toContain("insert into public.audit_events");
    expect(normalizedSql).toContain("'exception.status_updated'");
    expect(normalizedSql).toContain("'exception'");
    expect(normalizedSql).toContain("target_exception_id");
    expect(normalizedSql).toContain("'user'");
    expect(normalizedSql).toContain("auth.uid()");
    expect(migrationSql).toContain("status changed from %s to %s");
    expect(migrationSql).toContain("current_exception.title");
    expect(migrationSql).toContain("current_exception.status");
    expect(migrationSql).toContain("normalized_status");
  });

  it("does not add exceptions UPDATE RLS or audit_events INSERT RLS", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/for update to authenticated/);
    expect(normalizedSql).not.toMatch(/for insert to authenticated/);
    expect(normalizedSql).not.toMatch(/for delete to authenticated/);
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.exceptions/,
    );
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.audit_events/,
    );
  });

  it("revokes PUBLIC and anon and grants authenticated execute", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.update_exception_status(uuid, uuid, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.update_exception_status(uuid, uuid, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.update_exception_status(uuid, uuid, text) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.update_exception_status\(uuid, uuid, text\) to anon/,
    );
  });
});
