import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type {
  OrganizationRow,
  OrganizationSettingsRow,
} from "./types/rows";

export type UpdateOrganizationProfileInput = {
  name: string;
};

export type UpdateOrganizationSettingsInput = {
  fiscalYearStartMonth: number;
  defaultCashAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
};

function requireOrganizationName(name: string, operation: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new DataAccessError({
      operation,
      message: "Organization name is required",
    });
  }

  return normalized;
}

export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettingsRow | null> {
  const operation = "getOrganizationSettings";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", scopedOrganizationId);

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  const rows = unwrapRows<OrganizationSettingsRow>(operation, result);
  return rows[0] ?? null;
}

export async function updateOrganizationProfile(
  organizationId: string,
  input: UpdateOrganizationProfileInput,
): Promise<OrganizationRow> {
  const operation = "updateOrganizationProfile";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const organizationName = requireOrganizationName(input.name, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("update_organization_profile", {
    target_organization_id: scopedOrganizationId,
    organization_name: organizationName,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Organization profile update returned no row",
    });
  }

  return result.data as OrganizationRow;
}

export async function updateOrganizationSettings(
  organizationId: string,
  input: UpdateOrganizationSettingsInput,
): Promise<OrganizationSettingsRow> {
  const operation = "updateOrganizationSettings";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);

  if (
    !Number.isInteger(input.fiscalYearStartMonth) ||
    input.fiscalYearStartMonth < 1 ||
    input.fiscalYearStartMonth > 12
  ) {
    throw new DataAccessError({
      operation,
      message: "Fiscal year start month is invalid",
    });
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("update_organization_settings", {
    target_organization_id: scopedOrganizationId,
    fiscal_year_start_month: input.fiscalYearStartMonth,
    default_cash_account_id: input.defaultCashAccountId ?? null,
    default_revenue_account_id: input.defaultRevenueAccountId ?? null,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Organization settings update returned no row",
    });
  }

  return result.data as OrganizationSettingsRow;
}
