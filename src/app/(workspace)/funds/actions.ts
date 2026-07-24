"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createFund,
  type FundRecord,
  updateFund,
} from "@/lib/data/funds-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const GENERIC_CREATE_FUND_ERROR =
  "Unable to create fund. Please verify the information and your access, then try again.";

const GENERIC_UPDATE_FUND_ERROR =
  "Unable to update fund. Please verify the information and your access, then try again.";

export type CreateFundActionResult =
  | { ok: true; fund: FundRecord }
  | { ok: false; error: string };

export type UpdateFundActionResult =
  | { ok: true; fund: FundRecord }
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

export async function createFundAction(
  formData: FormData,
): Promise<CreateFundActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create funds.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const fund = await createFund(organizationId, {
      name: readFormString(formData, "name"),
      code: readOptionalFormString(formData, "code"),
      fundType: readOptionalFormString(formData, "fundType"),
    });

    revalidatePath("/funds");

    return { ok: true, fund };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Fund name is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_CREATE_FUND_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while creating a fund. Please try again.",
    };
  }
}

export async function updateFundAction(
  formData: FormData,
): Promise<UpdateFundActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to update funds.",
    };
  }

  const fundId = readFormString(formData, "fundId").trim();

  if (fundId === "") {
    return {
      ok: false,
      error: GENERIC_UPDATE_FUND_ERROR,
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const fund = await updateFund(organizationId, {
      fundId,
      name: readFormString(formData, "name"),
      code: readOptionalFormString(formData, "code"),
      fundType: readOptionalFormString(formData, "fundType"),
      status: readOptionalFormString(formData, "status"),
    });

    revalidatePath("/funds");

    return { ok: true, fund };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Fund name is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_UPDATE_FUND_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while updating a fund. Please try again.",
    };
  }
}
