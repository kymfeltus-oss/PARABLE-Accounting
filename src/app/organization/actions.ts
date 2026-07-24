"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import { createOrganization } from "@/lib/data/organization-bootstrap-repository";
import { acceptOrganizationInvite } from "@/lib/data/organization-invite-repository";
import { getUserOrganizationMemberships } from "@/lib/data/organization-membership-repository";
import {
  clearSelectedOrganizationId,
  setSelectedOrganizationId,
} from "@/lib/data/organization-selection";

const GENERIC_CREATE_ORG_ERROR =
  "Unable to set up your ministry. Please check the name and try again.";
const GENERIC_INVITE_ERROR =
  "Unable to join with that invite code. Please check it and try again.";

export type CreateOrganizationActionResult =
  | { ok: true; organizationId: string }
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

function slugifyOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createOrganizationAction(
  formData: FormData,
): Promise<CreateOrganizationActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to set up a ministry.",
    };
  }

  try {
    const name = readFormString(formData, "name");
    const slugInput = readFormString(formData, "slug");
    const slug = slugInput.trim() || slugifyOrganizationName(name);
    const organization = await createOrganization({ name, slug });

    await setSelectedOrganizationId(organization.id);
    revalidatePath("/", "layout");

    return { ok: true, organizationId: organization.id };
  } catch (error) {
    if (error instanceof DataAccessError) {
      const message = error.message.toLowerCase();

      if (message.includes("already in use") || message.includes("duplicate")) {
        return {
          ok: false,
          error:
            "That ministry web name is already taken. Please choose another.",
        };
      }

      if (message.includes("slug")) {
        return {
          ok: false,
          error:
            "Ministry web name can only use lowercase letters, numbers, and hyphens.",
        };
      }

      if (message.includes("name")) {
        return { ok: false, error: "Ministry name is required." };
      }

      return { ok: false, error: GENERIC_CREATE_ORG_ERROR };
    }

    return {
      ok: false,
      error: "Something went wrong while setting up your ministry. Please try again.",
    };
  }
}

export async function selectOrganizationAction(
  formData: FormData,
): Promise<void> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = readFormString(formData, "organizationId").trim();
  const memberships = await getUserOrganizationMemberships(user.id);
  const isMember = memberships.some(
    (membership) => membership.organizationId === organizationId,
  );

  if (!isMember) {
    redirect("/select-organization");
  }

  await setSelectedOrganizationId(organizationId);
  redirect("/dashboard");
}

export async function clearOrganizationSelectionAction(): Promise<void> {
  await clearSelectedOrganizationId();
  redirect("/select-organization");
}

export async function acceptOrganizationInviteAction(
  formData: FormData,
): Promise<SimpleActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to join a ministry." };
  }

  try {
    const membership = await acceptOrganizationInvite(
      readFormString(formData, "token"),
    );
    await setSelectedOrganizationId(membership.organization_id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return { ok: false, error: GENERIC_INVITE_ERROR };
    }

    return {
      ok: false,
      error: "Something went wrong while joining. Please try again.",
    };
  }
}
