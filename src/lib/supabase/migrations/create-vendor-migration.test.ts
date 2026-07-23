import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260721103000_create_vendor.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("create vendor RPC migration", () => {
  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain("20260721103000_create_vendor.sql");
  });

  it("creates create_vendor as SECURITY DEFINER with hardened search_path", () => {
    expectMigrationToMatch(
      /create or replace function public\.create_vendor\( target_organization_id uuid, vendor_name text, vendor_email text default null, vendor_phone text default null, vendor_tax_id_last_four text default null \)/,
    );
    expectMigrationToMatch(/returns public\.vendors/);
    expectMigrationToMatch(/language plpgsql/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("rejects unauthenticated callers via auth.uid() guard", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain("raise exception 'authenticated user is required'");
  });

  it("requires a non-null target organization id", () => {
    expect(normalizedSql).toContain("if target_organization_id is null then");
    expect(normalizedSql).toContain("raise exception 'organization is required'");
  });

  it("allows only owner, accountant, and staff via has_org_role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
  });

  it("excludes viewer from allowed roles", () => {
    expect(normalizedSql).not.toMatch(
      /array\['owner', 'accountant', 'staff', 'viewer'\]/,
    );
    expect(normalizedSql).not.toMatch(/array\['viewer'\]/);
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("validates vendor name is trimmed and nonblank", () => {
    expect(normalizedSql).toContain("normalized_name := btrim(vendor_name)");
    expect(normalizedSql).toContain("if normalized_name = '' then");
    expect(normalizedSql).toContain("raise exception 'vendor name is required'");
  });

  it("trims optional email and phone and converts blanks to null", () => {
    expect(normalizedSql).toContain("normalized_email := nullif(btrim(vendor_email), '')");
    expect(normalizedSql).toContain("normalized_phone := nullif(btrim(vendor_phone), '')");
  });

  it("validates tax ID last four is null or exactly four numeric digits", () => {
    expect(normalizedSql).toContain(
      "normalized_tax_id_last_four := nullif(btrim(vendor_tax_id_last_four), '')",
    );
    expect(normalizedSql).toContain(
      "if normalized_tax_id_last_four is not null and normalized_tax_id_last_four !~ '^[0-9]{4}$' then",
    );
    expect(normalizedSql).toContain(
      "raise exception 'invalid vendor tax id last four'",
    );
  });

  it("inserts vendors with server-controlled active status scoped to target_organization_id", () => {
    expectMigrationToMatch(
      /insert into public\.vendors \( organization_id, name, email, phone, tax_id_last_four, status \) values \( target_organization_id, normalized_name, normalized_email, normalized_phone, normalized_tax_id_last_four, 'active' \)/,
    );
    expect(normalizedSql).not.toContain("vendor_status");
    expect(normalizedSql).not.toMatch(/status = normalized_/);
  });

  it("relies on the existing organization-scoped vendor name constraint via insert", () => {
    expect(normalizedSql).toContain("insert into public.vendors");
    expect(normalizedSql).toContain("target_organization_id");
    expect(normalizedSql).toContain("normalized_name");
    expect(normalizedSql).not.toMatch(/create unique index/);
    expect(normalizedSql).not.toMatch(/vendors_organization_name_key/);
  });

  it("appends a vendor created audit event with actor_user_id in the same function", () => {
    expect(normalizedSql).toContain("insert into public.audit_events");
    expect(normalizedSql).toContain("'vendor.created'");
    expect(normalizedSql).toContain("'vendor'");
    expect(normalizedSql).toContain("created_vendor.id");
    expect(normalizedSql).toContain("'user'");
    expect(normalizedSql).toContain("auth.uid()");
    expect(migrationSql).toContain('Vendor "%s" created');
    expect(migrationSql).toContain("normalized_name");
  });

  it("returns the newly created vendor row", () => {
    expect(normalizedSql).toContain("returning * into created_vendor");
    expect(normalizedSql).toContain("return created_vendor");
  });

  it("does not add vendors write RLS or audit_events INSERT RLS", () => {
    expect(normalizedSql).not.toMatch(/create policy/);
    expect(normalizedSql).not.toMatch(/for update to authenticated/);
    expect(normalizedSql).not.toMatch(/for insert to authenticated/);
    expect(normalizedSql).not.toMatch(/for delete to authenticated/);
    expect(normalizedSql).not.toMatch(/create policy[\s\S]*on public\.vendors/);
    expect(normalizedSql).not.toMatch(
      /create policy[\s\S]*on public\.audit_events/,
    );
  });

  it("revokes PUBLIC and anon and grants authenticated execute", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.create_vendor(uuid, text, text, text, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.create_vendor(uuid, text, text, text, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.create_vendor(uuid, text, text, text, text) to authenticated",
    );
    expect(normalizedSql).not.toMatch(
      /grant execute on function public\.create_vendor\(uuid, text, text, text, text\) to anon/,
    );
  });
});
