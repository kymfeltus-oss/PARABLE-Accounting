import { describe, expect, it, vi } from "vitest";

import { createEmptyAuditVaultData } from "@/lib/data/test/audit-vault-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getAuditVaultDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getAuditVaultDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/audit-vault-repository", () => ({
  getAuditVaultData: getAuditVaultDataMock,
}));

import AuditVaultPage from "./page";
import { AuditVaultPageContent } from "@/components/audit-vault/audit-vault-page-content";

describe("Audit Vault page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getAuditVaultData", async () => {
    const auditVaultData = createEmptyAuditVaultData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getAuditVaultDataMock.mockResolvedValue(auditVaultData);

    await AuditVaultPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getAuditVaultDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned audit vault data to AuditVaultPageContent", async () => {
    const auditVaultData = createEmptyAuditVaultData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getAuditVaultDataMock.mockResolvedValue(auditVaultData);

    const page = await AuditVaultPage();

    expect(page.type).toBe(AuditVaultPageContent);
    expect(page.props.data).toEqual(auditVaultData);
  });
});
