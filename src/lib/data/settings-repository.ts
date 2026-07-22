import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type {
  OrganizationMembershipRow,
  OrganizationRow,
} from "./types/rows";

export type SettingsData = {
  organizationId: string;
  organization: OrganizationRow;
  memberships: OrganizationMembershipRow[];
  counts: {
    totalMemberships: number;
  };
};

export async function getSettingsData(
  organizationId: string,
): Promise<SettingsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getSettingsData",
  );
  const supabase = await createServerSupabaseClient();

  const [organizationResult, membershipsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", scopedOrganizationId),
    supabase
      .from("organization_memberships")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("created_at", { ascending: false }),
  ]);

  if (organizationResult.error) {
    throw toDataAccessError(
      "getSettingsData.organization",
      organizationResult.error,
    );
  }

  const organizationRows = (organizationResult.data ?? []) as OrganizationRow[];

  if (organizationRows.length === 0) {
    throw new DataAccessError({
      operation: "getSettingsData.organization",
      message: "Organization not found for the configured organization id",
    });
  }

  const memberships = unwrapRows<OrganizationMembershipRow>(
    "getSettingsData.memberships",
    membershipsResult,
  );

  return {
    organizationId: scopedOrganizationId,
    organization: organizationRows[0],
    memberships,
    counts: {
      totalMemberships: memberships.length,
    },
  };
}
