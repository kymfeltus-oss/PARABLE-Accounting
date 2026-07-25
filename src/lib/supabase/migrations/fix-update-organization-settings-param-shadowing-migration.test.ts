import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationFilename =
  "20260806103000_fix_update_organization_settings_param_shadowing.sql";

function readMigrationSql(): string {
  return readFileSync(
    path.join(process.cwd(), "supabase", "migrations", migrationFilename),
    "utf8",
  );
}

describe("fix update_organization_settings param shadowing migration", () => {
  it("renames parameters to avoid column collisions", () => {
    const sql = readMigrationSql();

    expect(sql).toContain(
      "drop function if exists public.update_organization_settings(uuid, integer, uuid, uuid)",
    );
    expect(sql).toContain("p_fiscal_year_start_month");
    expect(sql).toContain("p_default_cash_account_id");
    expect(sql).toContain("p_default_revenue_account_id");
    expect(sql).toContain(
      "fiscal_year_start_month = p_fiscal_year_start_month",
    );
    expect(sql.replace(/\s+/g, " ")).toContain(
      "insert into public.organization_settings ( organization_id, fiscal_year_start_month",
    );
  });

  it("backfills missing organization_settings rows", () => {
    const sql = readMigrationSql();

    expect(sql).toContain(
      "insert into public.organization_settings (organization_id, fiscal_year_start_month)",
    );
    expect(sql).toContain("from public.organizations o");
  });
});
