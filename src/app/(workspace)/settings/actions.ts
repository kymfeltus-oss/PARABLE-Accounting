"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import {
  createOrganizationInvite,
  revokeOrganizationInvite,
  updateMembershipRole,
  type InviteRole,
} from "@/lib/data/organization-invite-repository";
import {
  updateOrganizationProfile,
  updateOrganizationSettings,
} from "@/lib/data/organization-settings-repository";

const GENERIC_INVITE_ERROR =
  "Unable to complete invite action. Please verify your access and try again.";
const GENERIC_SETTINGS_ERROR =
  "Unable to update settings. Please verify the values and your access, then try again.";

export type CreateInviteActionResult =
  | { ok: true; token: string; inviteId: string; expiresAt: string }
  | { ok: false; error: string };

export type SimpleActionResult =
  | { ok: true }
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

export async function createOrganizationInviteAction(
  formData: FormData,
): Promise<CreateInviteActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to create invites." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const role = readFormString(formData, "role") as InviteRole;
    const created = await createOrganizationInvite(organizationId, {
      role,
      email: readOptionalFormString(formData, "email"),
      expiresInDays: Number(readFormString(formData, "expiresInDays") || "14"),
    });

    revalidatePath("/settings");

    return {
      ok: true,
      token: created.token,
      inviteId: created.invite.id,
      expiresAt: created.invite.expires_at,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return { ok: false, error: GENERIC_INVITE_ERROR };
    }

    return {
      ok: false,
      error: "Something went wrong while creating the invite. Please try again.",
    };
  }
}

export async function revokeOrganizationInviteAction(
  formData: FormData,
): Promise<SimpleActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to revoke invites." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    await revokeOrganizationInvite(
      organizationId,
      readFormString(formData, "inviteId"),
    );
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return { ok: false, error: GENERIC_INVITE_ERROR };
    }

    return {
      ok: false,
      error: "Something went wrong while revoking the invite. Please try again.",
    };
  }
}

export async function updateMembershipRoleAction(
  formData: FormData,
): Promise<SimpleActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to update roles." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    await updateMembershipRole(
      organizationId,
      readFormString(formData, "membershipId"),
      readFormString(formData, "role"),
    );
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return { ok: false, error: GENERIC_INVITE_ERROR };
    }

    return {
      ok: false,
      error: "Something went wrong while updating the role. Please try again.",
    };
  }
}

export async function updateOrganizationProfileAction(
  formData: FormData,
): Promise<SimpleActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to update the profile." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    await updateOrganizationProfile(organizationId, {
      name: readFormString(formData, "name"),
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message.toLowerCase().includes("name")) {
        return { ok: false, error: "Ministry name is required." };
      }

      return { ok: false, error: GENERIC_SETTINGS_ERROR };
    }

    return {
      ok: false,
      error:
        "Something went wrong while updating the profile. Please try again.",
    };
  }
}

export async function updateOrganizationSettingsAction(
  formData: FormData,
): Promise<SimpleActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to update settings." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const fiscalYearStartMonth = Number(
      readFormString(formData, "fiscalYearStartMonth"),
    );
    await updateOrganizationSettings(organizationId, {
      fiscalYearStartMonth,
      defaultCashAccountId: readOptionalFormString(
        formData,
        "defaultCashAccountId",
      ),
      defaultRevenueAccountId: readOptionalFormString(
        formData,
        "defaultRevenueAccountId",
      ),
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return { ok: false, error: GENERIC_SETTINGS_ERROR };
    }

    return {
      ok: false,
      error: "Something went wrong while updating settings. Please try again.",
    };
  }
}
