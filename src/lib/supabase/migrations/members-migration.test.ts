import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_create_members.sql"),
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

describe("members migration", () => {
  it("has exactly one members migration file", () => {
    expect(migrationFiles).toHaveLength(1);
  });

  it("creates the public.members table with a UUID primary key", () => {
    expect(normalizedSql).toContain("create table public.members");
    expect(normalizedSql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
  });

  it("links each member to one organization with cascading delete", () => {
    expect(hasColumnDefinition("organization_id", "uuid not null")).toBe(true);
    expect(normalizedSql).toContain("constraint members_organization_id_fkey");
    expect(normalizedSql).toContain(
      "foreign key (organization_id) references public.organizations(id) on delete cascade",
    );
  });

  it("requires nonblank first and last names", () => {
    expect(hasColumnDefinition("first_name", "text not null")).toBe(true);
    expect(hasColumnDefinition("last_name", "text not null")).toBe(true);
    expect(normalizedSql).toContain("constraint members_first_name_not_blank");
    expect(normalizedSql).toContain("char_length(btrim(first_name)) > 0");
    expect(normalizedSql).toContain("constraint members_last_name_not_blank");
    expect(normalizedSql).toContain("char_length(btrim(last_name)) > 0");
  });

  it("allows nullable nonblank email values without uniqueness", () => {
    expect(hasColumnDefinition("email", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*email\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint members_email_not_blank");
    expect(normalizedSql).toContain("email is null");
    expect(normalizedSql).toContain("char_length(btrim(email)) > 0");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*email\s*\)/);
    expect(normalizedSql).not.toMatch(
      /\bunique\s*\(\s*organization_id\s*,\s*email\s*\)/,
    );
    expect(normalizedSql).not.toMatch(/(?:\(|,)\s*email\s+text\s+unique\b/);
  });

  it("allows nullable nonblank phone values without uniqueness", () => {
    expect(hasColumnDefinition("phone", "text")).toBe(true);
    expect(normalizedSql).not.toMatch(
      /(?:\(|,)\s*phone\s+text\s+not\s+null\b/,
    );
    expect(normalizedSql).toContain("constraint members_phone_not_blank");
    expect(normalizedSql).toContain("phone is null");
    expect(normalizedSql).toContain("char_length(btrim(phone)) > 0");
    expect(normalizedSql).not.toMatch(/\bunique\s*\(\s*phone\s*\)/);
    expect(normalizedSql).not.toMatch(/(?:\(|,)\s*phone\s+text\s+unique\b/);
  });

  it("restricts status to active or inactive with an active default", () => {
    expect(
      hasColumnDefinition("status", "text not null default 'active'"),
    ).toBe(true);
    expect(normalizedSql).toMatch(
      /constraint members_status_valid check \( status in \( 'active', 'inactive' \) \)/,
    );

    const deferredStatusValues = [
      "deceased",
      "archived",
      "visitor",
      "prospect",
      "suspended",
    ];

    for (const status of deferredStatusValues) {
      expect(normalizedSql).not.toContain(`'${status}'`);
    }
  });

  it("does not include auth or user linkage columns", () => {
    const authColumns = ["user_id", "auth_user_id", "profile_id"];

    for (const column of authColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }

    expect(normalizedSql).not.toContain("auth.users");
  });

  it("does not include address columns", () => {
    const addressColumns = [
      "address_line_1",
      "address_line_2",
      "city",
      "state",
      "postal_code",
      "country",
    ];

    for (const column of addressColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include household or family relationship columns", () => {
    const householdColumns = [
      "household_id",
      "family_id",
      "spouse_id",
      "head_of_household_id",
    ];

    for (const column of householdColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include giving relationships or derived giving totals", () => {
    const givingColumns = [
      "giving_transaction_id",
      "donation_id",
      "contribution_id",
      "lifetime_giving",
      "year_to_date_giving",
      "total_giving",
    ];

    for (const column of givingColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include sensitive tax or government identifiers", () => {
    const sensitiveTaxColumns = ["tax_id", "ssn", "tax_exempt_number"];

    for (const column of sensitiveTaxColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include communication preference columns", () => {
    const communicationColumns = [
      "email_opt_in",
      "sms_opt_in",
      "do_not_contact",
      "preferred_contact_method",
    ];

    for (const column of communicationColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include demographic or sensitive personal attributes", () => {
    const demographicColumns = [
      "date_of_birth",
      "birth_date",
      "gender",
      "race",
      "ethnicity",
      "marital_status",
    ];

    for (const column of demographicColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("does not include additional name columns", () => {
    const nameColumns = [
      "preferred_name",
      "nickname",
      "middle_name",
      "prefix",
      "suffix",
    ];

    for (const column of nameColumns) {
      expect(hasColumnNamed(column)).toBe(false);
    }
  });

  it("records creation and update timestamps without triggers", () => {
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
      "alter table public.members enable row level security",
    );
    expect(normalizedSql).not.toContain("create policy");
  });

  it("does not create future member, giving, or care domain tables", () => {
    const futureDomainTables = [
      "giving_transactions",
      "donations",
      "contributions",
      "households",
      "addresses",
      "attendance",
      "volunteer_assignments",
      "communications",
      "pastoral_care",
      "tax_statements",
    ];

    for (const table of futureDomainTables) {
      expect(createsTableNamed(table)).toBe(false);
    }
  });
});
