import { DataAccessError } from "./data-access-error";

export function requireOrganizationId(
  organizationId: string,
  operation: string,
): string {
  const trimmed = organizationId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "organizationId is required and must be a non-empty string",
    });
  }

  return trimmed;
}
