import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260804103000_budget_write_rpcs.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("budget write RPC migration", () => {
  it("creates create_budget, upsert_budget_line, and activate_budget", () => {
    expectMigrationToMatch(/create or replace function public\.create_budget\(/);
    expectMigrationToMatch(/create or replace function public\.upsert_budget_line\(/);
    expectMigrationToMatch(/create or replace function public\.activate_budget\(/);
  });

  it("uses SECURITY DEFINER and empty search_path for all RPCs", () => {
    expect(normalizedSql.match(/security definer/g)?.length).toBeGreaterThanOrEqual(3);
    expect(normalizedSql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("requires staff or higher for create and upsert, owner or accountant for activate", () => {
    expect(normalizedSql).toContain(
      "raise exception 'insufficient role to create budget'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'insufficient role to upsert budget line'",
    );
    expect(normalizedSql).toContain(
      "raise exception 'insufficient role to activate budget'",
    );
    expect(normalizedSql).toContain("array['owner', 'accountant', 'staff']");
    expect(normalizedSql).toContain("array['owner', 'accountant']");
  });

  it("upserts budget lines by budget, account, and fund", () => {
    expect(normalizedSql).toContain("raise exception 'account is required'");
    expect(normalizedSql).toContain(
      "budget lines must use expense or revenue accounts",
    );
    expect(normalizedSql).toContain("coalesce(max(line_number), 0) + 1");
  });

  it("activates only draft budgets", () => {
    expect(normalizedSql).toContain(
      "raise exception 'only draft budgets can be activated'",
    );
    expect(normalizedSql).toContain("status = 'active'");
    expect(normalizedSql).toContain("'budget.activated'");
  });

  it("grants execute to authenticated for all RPCs", () => {
    expect(migrationSql).toContain(
      "grant execute on function public.create_budget(uuid, text, date, date, text) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.upsert_budget_line(uuid, uuid, uuid, numeric, uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.activate_budget(uuid, uuid) to authenticated",
    );
  });
});
