import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260802113000_bills_ap_rpcs.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();

function expectMigrationToMatch(pattern: RegExp) {
  expect(normalizedSql).toMatch(pattern);
}

describe("bills AP RPC migration", () => {
  it("creates create_bill with the expected signature", () => {
    expectMigrationToMatch(/create or replace function public\.create_bill\(/);
    expectMigrationToMatch(/returns public\.bills/);
  });

  it("creates open_bill, pay_bill, and void_bill", () => {
    expectMigrationToMatch(/create or replace function public\.open_bill\(/);
    expectMigrationToMatch(/create or replace function public\.pay_bill\(/);
    expectMigrationToMatch(/create or replace function public\.void_bill\(/);
  });

  it("uses SECURITY DEFINER and empty search_path for all RPCs", () => {
    expect(normalizedSql.match(/security definer/g)?.length).toBeGreaterThanOrEqual(4);
    expect(normalizedSql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("pay_bill posts a balanced bill journal and bill payment", () => {
    expect(normalizedSql).toContain("source_type");
    expect(normalizedSql).toContain("'bill'");
    expect(normalizedSql).toContain("insert into public.bill_payments");
    expect(normalizedSql).toContain("status = 'paid'");
    expect(normalizedSql).toContain("'bill.paid'");
    expect(normalizedSql).toContain("raise exception 'bill is not in open status'");
  });

  it("void_bill rejects paid bills", () => {
    expect(normalizedSql).toContain("raise exception 'paid bills cannot be voided'");
    expect(normalizedSql).toContain("status = 'void'");
    expect(normalizedSql).toContain("'bill.voided'");
  });

  it("grants execute to authenticated for all RPCs", () => {
    expect(migrationSql).toContain(
      "grant execute on function public.create_bill(uuid, uuid, date, numeric, text, date, text, text, uuid, uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.open_bill(uuid, uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.pay_bill(uuid, uuid, date, uuid, uuid, uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.void_bill(uuid, uuid) to authenticated",
    );
  });
});
