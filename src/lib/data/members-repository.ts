import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { MemberRow } from "./types/rows";

export type MembersData = {
  organizationId: string;
  members: MemberRow[];
  counts: {
    total: number;
    active: number;
    inactive: number;
  };
};

export async function getMembersData(
  organizationId: string,
): Promise<MembersData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getMembersData",
  );
  const supabase = await createServerSupabaseClient();

  const membersResult = await supabase
    .from("members")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  const members = unwrapRows<MemberRow>(
    "getMembersData.members",
    membersResult,
  );

  const active = members.filter((member) => member.status === "active").length;
  const inactive = members.filter(
    (member) => member.status === "inactive",
  ).length;

  return {
    organizationId: scopedOrganizationId,
    members,
    counts: {
      total: members.length,
      active,
      inactive,
    },
  };
}
