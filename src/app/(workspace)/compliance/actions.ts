"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import {
  updateComplianceItemStatus,
  type ComplianceItemStatus,
} from "@/lib/data/compliance-repository";
import { DataAccessError } from "@/lib/data/data-access-error";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import type { ComplianceItemRow } from "@/lib/data/types/rows";

export type UpdateComplianceItemStatusActionInput = {
  itemId: string;
  nextStatus: ComplianceItemStatus;
};

export type UpdateComplianceItemStatusActionResult =
  | { ok: true; item: ComplianceItemRow }
  | { ok: false; error: string };

export async function updateComplianceItemStatusAction(
  input: UpdateComplianceItemStatusActionInput,
): Promise<UpdateComplianceItemStatusActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to update compliance items.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const item = await updateComplianceItemStatus(
      organizationId,
      input.itemId,
      input.nextStatus,
    );

    revalidatePath("/compliance");

    return { ok: true, item };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error:
          "Unable to update compliance item status. Please verify your access and try again.",
      };
    }

    return {
      ok: false,
      error:
        "Something went wrong while updating compliance item status. Please try again.",
    };
  }
}
