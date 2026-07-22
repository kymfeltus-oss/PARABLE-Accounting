import { describe, expect, it } from "vitest";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";

describe("requireOrganizationId", () => {
  it("returns a trimmed organization id", () => {
    expect(requireOrganizationId("  org-123  ", "testOperation")).toBe("org-123");
  });

  it("throws DataAccessError when organizationId is empty", () => {
    expect(() => requireOrganizationId("", "testOperation")).toThrow(
      DataAccessError,
    );
    expect(() => requireOrganizationId("   ", "testOperation")).toThrow(
      DataAccessError,
    );
  });
});
