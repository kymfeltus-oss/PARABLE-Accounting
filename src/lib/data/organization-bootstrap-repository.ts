import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { toDataAccessError } from "./query-helpers";
import type { OrganizationRow } from "./types/rows";

export type CreateOrganizationInput = {
  name: string;
  slug: string;
};

function requireOrganizationName(name: string, operation: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new DataAccessError({
      operation,
      message: "Organization name is required",
    });
  }

  return normalized;
}

function requireOrganizationSlug(slug: string, operation: string): string {
  const normalized = slug.trim().toLowerCase();

  if (!normalized) {
    throw new DataAccessError({
      operation,
      message: "Organization slug is required",
    });
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new DataAccessError({
      operation,
      message: "Organization slug format is invalid",
    });
  }

  return normalized;
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<OrganizationRow> {
  const operation = "createOrganization";
  const organizationName = requireOrganizationName(input.name, operation);
  const organizationSlug = requireOrganizationSlug(input.slug, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_organization", {
    organization_name: organizationName,
    organization_slug: organizationSlug,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createOrganization RPC diagnostic]", {
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
      message: "Organization creation returned no row",
    });
  }

  return result.data as OrganizationRow;
}
