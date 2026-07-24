"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createMember,
  updateMember,
} from "@/lib/data/members-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import type { MemberRow } from "@/lib/data/types/rows";

const GENERIC_CREATE_MEMBER_ERROR =
  "Unable to create member. Please verify the information and your access, then try again.";

const GENERIC_UPDATE_MEMBER_ERROR =
  "Unable to update member. Please verify the information and your access, then try again.";

export type CreateMemberActionResult =
  | { ok: true; member: MemberRow }
  | { ok: false; error: string };

export type UpdateMemberActionResult =
  | { ok: true; member: MemberRow }
  | { ok: false; error: string };

function readFormString(formData: FormData, field: string): string {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function readOptionalFormString(
  formData: FormData,
  field: string,
): string | null {
  const trimmed = readFormString(formData, field).trim();

  return trimmed === "" ? null : trimmed;
}

export async function createMemberAction(
  formData: FormData,
): Promise<CreateMemberActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create members.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const member = await createMember(organizationId, {
      firstName: readFormString(formData, "firstName"),
      lastName: readFormString(formData, "lastName"),
      email: readOptionalFormString(formData, "email"),
      phone: readOptionalFormString(formData, "phone"),
    });

    revalidatePath("/members");

    return { ok: true, member };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "firstName is required") {
        return {
          ok: false,
          error: "Member first name is required.",
        };
      }

      if (error.message === "lastName is required") {
        return {
          ok: false,
          error: "Member last name is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_CREATE_MEMBER_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while creating a member. Please try again.",
    };
  }
}

export async function updateMemberAction(
  formData: FormData,
): Promise<UpdateMemberActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to update members.",
    };
  }

  const memberId = readFormString(formData, "memberId").trim();

  if (memberId === "") {
    return {
      ok: false,
      error: GENERIC_UPDATE_MEMBER_ERROR,
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const member = await updateMember(organizationId, {
      memberId,
      firstName: readFormString(formData, "firstName"),
      lastName: readFormString(formData, "lastName"),
      email: readOptionalFormString(formData, "email"),
      phone: readOptionalFormString(formData, "phone"),
      status: readOptionalFormString(formData, "status"),
    });

    revalidatePath("/members");

    return { ok: true, member };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "firstName is required") {
        return {
          ok: false,
          error: "Member first name is required.",
        };
      }

      if (error.message === "lastName is required") {
        return {
          ok: false,
          error: "Member last name is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_UPDATE_MEMBER_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while updating a member. Please try again.",
    };
  }
}
