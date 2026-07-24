import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");

function readMigration(filename: string) {
  const migrationPath = join(migrationsDirectory, filename);
  const migrationSql = readFileSync(migrationPath, "utf8");
  const normalizedSql = migrationSql.toLowerCase().replace(/\s+/g, " ").trim();
  return { migrationPath, migrationSql, normalizedSql };
}

describe("organization settings migration", () => {
  const { migrationPath, normalizedSql } = readMigration(
    "20260731103000_organization_settings.sql",
  );

  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain("20260731103000_organization_settings.sql");
  });

  it("creates organization_settings with fiscal year and default account columns", () => {
    expect(normalizedSql).toContain("create table public.organization_settings");
    expect(normalizedSql).toContain("fiscal_year_start_month integer not null default 1");
    expect(normalizedSql).toContain("default_cash_account_id uuid");
    expect(normalizedSql).toContain("default_revenue_account_id uuid");
  });

  it("enables member select RLS only", () => {
    expect(normalizedSql).toContain("enable row level security");
    expect(normalizedSql).toContain("organization_settings_select_member");
    expect(normalizedSql).not.toContain("for insert");
    expect(normalizedSql).not.toContain("for update");
  });
});

describe("create organization RPC migration", () => {
  const { migrationPath, normalizedSql } = readMigration(
    "20260731113000_create_organization.sql",
  );

  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain("20260731113000_create_organization.sql");
  });

  it("creates create_organization as SECURITY DEFINER with hardened search_path", () => {
    expect(normalizedSql).toContain(
      "create or replace function public.create_organization(",
    );
    expect(normalizedSql).toContain("security definer");
    expect(normalizedSql).toContain("set search_path = ''");
  });

  it("rejects unauthenticated callers and seeds owner membership", () => {
    expect(normalizedSql).toContain("if auth.uid() is null then");
    expect(normalizedSql).toContain("role");
    expect(normalizedSql).toContain("'owner'");
    expect(normalizedSql).toContain("insert into public.organization_memberships");
  });

  it("seeds starter accounts, fund, period, bank account, and settings", () => {
    expect(normalizedSql).toContain("insert into public.accounts");
    expect(normalizedSql).toContain("'operating checking'");
    expect(normalizedSql).toContain("insert into public.funds");
    expect(normalizedSql).toContain("'general fund'");
    expect(normalizedSql).toContain("insert into public.accounting_periods");
    expect(normalizedSql).toContain("insert into public.bank_accounts");
    expect(normalizedSql).toContain("insert into public.organization_settings");
  });

  it("writes organization.created audit and grants execute to authenticated only", () => {
    expect(normalizedSql).toContain("'organization.created'");
    expect(normalizedSql).toContain(
      "revoke execute on function public.create_organization(text, text) from anon",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.create_organization(text, text) to authenticated",
    );
  });
});

describe("organization invites migration", () => {
  const { migrationPath, normalizedSql } = readMigration(
    "20260731123000_organization_invites.sql",
  );

  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain("20260731123000_organization_invites.sql");
  });

  it("stores token hash only with sha256 hex format check", () => {
    expect(normalizedSql).toContain("create table public.organization_invites");
    expect(normalizedSql).toContain("token_hash text not null");
    expect(normalizedSql).toContain("token_hash ~ '^[a-f0-9]{64}$'");
    expect(normalizedSql).not.toMatch(
      /insert into public\.organization_invites[\s\S]*invite_token[^_]/,
    );
  });

  it("limits invite roles to accountant, staff, and viewer", () => {
    expect(normalizedSql).toContain(
      "constraint organization_invites_role_valid check (role in ('accountant', 'staff', 'viewer'))",
    );
  });

  it("creates invite/accept/revoke/role RPCs as SECURITY DEFINER", () => {
    expect(normalizedSql).toContain("create_organization_invite");
    expect(normalizedSql).toContain("accept_organization_invite");
    expect(normalizedSql).toContain("revoke_organization_invite");
    expect(normalizedSql).toContain("update_membership_role");
    expect(normalizedSql).toContain("security definer");
    expect(normalizedSql).toContain("cannot remove the last organization owner");
  });

  it("restricts invite select RLS to owners", () => {
    expect(normalizedSql).toContain("organization_invites_select_owner");
    expect(normalizedSql).toContain(
      "has_org_role(organization_id, array['owner'])",
    );
  });
});

describe("update organization settings RPC migration", () => {
  const { migrationPath, normalizedSql } = readMigration(
    "20260731133000_update_organization_settings.sql",
  );

  it("uses the approved migration filename", () => {
    expect(migrationPath).toContain(
      "20260731133000_update_organization_settings.sql",
    );
  });

  it("creates profile and settings update RPCs with role gates", () => {
    expect(normalizedSql).toContain("update_organization_profile");
    expect(normalizedSql).toContain("update_organization_settings");
    expect(normalizedSql).toContain("array['owner']");
    expect(normalizedSql).toContain("array['owner', 'accountant']");
    expect(normalizedSql).toContain("'organization.profile_updated'");
    expect(normalizedSql).toContain("'organization.settings_updated'");
  });
});
