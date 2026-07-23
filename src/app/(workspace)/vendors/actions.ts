"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import {
  createVendor,
  type VendorRecord,
} from "@/lib/data/vendors-repository";

const GENERIC_CREATE_VENDOR_ERROR =
  "Unable to create vendor. Please verify the information and your access, then try again.";

export type CreateVendorActionResult =
  | { ok: true; vendor: VendorRecord }
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

export async function createVendorAction(
  formData: FormData,
): Promise<CreateVendorActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create vendors.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const vendor = await createVendor(organizationId, {
      name: readFormString(formData, "name"),
      email: readOptionalFormString(formData, "email"),
      phone: readOptionalFormString(formData, "phone"),
      taxIdLastFour: readOptionalFormString(formData, "taxIdLastFour"),
    });

    revalidatePath("/vendors");

    return { ok: true, vendor };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Vendor name is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_CREATE_VENDOR_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while creating a vendor. Please try again.",
    };
  }
}
