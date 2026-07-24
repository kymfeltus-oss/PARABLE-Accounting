import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
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

export type CreateMemberInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

export type UpdateMemberInput = {
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

function requireMemberName(
  value: string,
  field: "firstName" | "lastName",
  operation: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: `${field} is required`,
    });
  }

  return trimmed;
}

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

export async function createMember(
  organizationId: string,
  input: CreateMemberInput,
): Promise<MemberRow> {
  const operation = "createMember";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const firstName = requireMemberName(input.firstName, "firstName", operation);
  const lastName = requireMemberName(input.lastName, "lastName", operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_member", {
    target_organization_id: scopedOrganizationId,
    member_first_name: firstName,
    member_last_name: lastName,
    member_email: input.email ?? null,
    member_phone: input.phone ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createMember RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Member creation returned no row",
    });
  }

  return result.data as MemberRow;
}

export async function updateMember(
  organizationId: string,
  input: UpdateMemberInput,
): Promise<MemberRow> {
  const operation = "updateMember";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const firstName = requireMemberName(input.firstName, "firstName", operation);
  const lastName = requireMemberName(input.lastName, "lastName", operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("update_member", {
    target_organization_id: scopedOrganizationId,
    target_member_id: input.memberId,
    member_first_name: firstName,
    member_last_name: lastName,
    member_email: input.email ?? null,
    member_phone: input.phone ?? null,
    member_status: input.status ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[updateMember RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Member update returned no row",
    });
  }

  return result.data as MemberRow;
}
