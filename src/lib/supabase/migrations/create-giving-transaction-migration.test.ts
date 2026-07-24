import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260802103000_create_giving_transaction.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("create giving transaction RPC migration", () => {
  it("creates create_giving_transaction with the expected signature", () => {
    expectMigrationToMatch(
      /create or replace function public\.create_giving_transaction\( target_organization_id uuid, input_transaction_date date, input_amount numeric, input_giving_method text default 'other', input_member_id uuid default null, input_fund_id uuid default null, input_reference text default null \)/,
    );
    expectMigrationToMatch(/returns public\.giving_transactions/);
  });

  it("uses plpgsql, SECURITY DEFINER, and an empty search_path", () => {
    expectMigrationToMatch(/language plpgsql/);
    expectMigrationToMatch(/security definer/);
    expectMigrationToMatch(/set search_path = ''/);
  });

  it("allows staff+ via has_org_role", () => {
    expect(normalizedSql).toContain(
      "public.has_org_role( target_organization_id, array['owner', 'accountant', 'staff'] )",
    );
    expect(normalizedSql).not.toContain("'viewer'");
  });

  it("creates giving with recorded status and audit event", () => {
    expect(normalizedSql).toContain("'recorded'");
    expect(normalizedSql).toContain("'giving.created'");
    expect(normalizedSql.match(/insert into public\.audit_events/g)?.length).toBe(1);
  });

  it("hardens execute grants", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.create_giving_transaction(uuid, date, numeric, text, uuid, uuid, text) from public",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.create_giving_transaction(uuid, date, numeric, text, uuid, uuid, text) to authenticated",
    );
  });
});
