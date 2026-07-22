"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  updateExceptionStatus,
  type ExceptionStatus,
} from "@/lib/data/exceptions-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import type { ExceptionRow } from "@/lib/data/types/rows";

export type UpdateExceptionStatusActionInput = {
  exceptionId: string;
  nextStatus: ExceptionStatus;
};

export type UpdateExceptionStatusActionResult =
  | { ok: true; item: ExceptionRow }
  | { ok: false; error: string };

export async function updateExceptionStatusAction(
  input: UpdateExceptionStatusActionInput,
): Promise<UpdateExceptionStatusActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to update exceptions.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const item = await updateExceptionStatus(
      organizationId,
      input.exceptionId,
      input.nextStatus,
    );

    revalidatePath("/exceptions");

    return { ok: true, item };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error:
          "Unable to update exception status. Please verify your access and try again.",
      };
    }

    return {
      ok: false,
      error:
        "Something went wrong while updating exception status. Please try again.",
    };
  }
}
