import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GivingDetailPageContent } from "@/components/giving/giving-detail-page-content";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";
import type { GivingTransactionRecord } from "@/lib/data/giving-repository";

const {
  getCurrentOrganizationIdMock,
  getGivingTransactionByIdMock,
  getGivingDebitAccountOptionsMock,
  getGivingRevenueAccountOptionsMock,
  getGivingJournalLinkageMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getGivingTransactionByIdMock: vi.fn(),
  getGivingDebitAccountOptionsMock: vi.fn(),
  getGivingRevenueAccountOptionsMock: vi.fn(),
  getGivingJournalLinkageMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/giving-repository", () => ({
  getGivingTransactionById: getGivingTransactionByIdMock,
}));

vi.mock("@/lib/data/giving-recording-options", () => ({
  getGivingDebitAccountOptions: getGivingDebitAccountOptionsMock,
  getGivingRevenueAccountOptions: getGivingRevenueAccountOptionsMock,
}));

vi.mock("@/lib/data/giving-journal-linkage", () => ({
  getGivingJournalLinkage: getGivingJournalLinkageMock,
}));

import GivingDetailPage, { GivingDetailPageView } from "./page";

const VALID_GIVING_ID = "66666666-6666-4666-8666-666666666666";

function createTransaction(
  overrides: Partial<GivingTransactionRecord> = {},
): GivingTransactionRecord {
  return {
    id: VALID_GIVING_ID,
    organization_id: TEST_ORGANIZATION_ID,
    member_id: "member-1",
    fund_id: "fund-1",
    transaction_date: "2026-07-10",
    amount: 250,
    giving_method: "check",
    reference: "CHK-1001",
    status: "recorded",
    journal_entry_id: null,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    fundName: "General Fund",
    ...overrides,
  };
}

function createAccountOptions() {
  return [
    {
      id: "acct-asset",
      code: "1000",
      name: "Operating Checking",
      accountType: "asset" as const,
      displayLabel: "1000 — Operating Checking",
    },
  ];
}

function createJournalLinkage() {
  return {
    journalEntryId: "77777777-7777-4777-8777-777777777777",
    entryNumber: "GIV-66666666666646668666666666666666",
    entryDate: "2026-07-10",
    status: "posted" as const,
    totalDebit: 250,
    totalCredit: 250,
    periodName: "July 2026",
    sourceReference: "CHK-1001",
  };
}

describe("Giving detail page wiring", () => {
  beforeEach(() => {
    getCurrentOrganizationIdMock.mockReset();
    getGivingTransactionByIdMock.mockReset();
    getGivingDebitAccountOptionsMock.mockReset();
    getGivingRevenueAccountOptionsMock.mockReset();
    getGivingJournalLinkageMock.mockReset();
    notFoundMock.mockClear();
    getGivingDebitAccountOptionsMock.mockResolvedValue(createAccountOptions());
    getGivingRevenueAccountOptionsMock.mockResolvedValue(createAccountOptions());
    getGivingJournalLinkageMock.mockResolvedValue(createJournalLinkage());
  });

  it("renders the detail page for a valid giving transaction", async () => {
    const transaction = createTransaction();
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingTransactionByIdMock.mockResolvedValue(transaction);

    const page = await GivingDetailPage({
      params: Promise.resolve({ id: VALID_GIVING_ID }),
    });

    expect(getGivingTransactionByIdMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_GIVING_ID,
    );
    expect(page.type).toBe(GivingDetailPageView);
    expect(page.props.transaction).toEqual(transaction);
    expect(getGivingDebitAccountOptionsMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      "check",
    );
    expect(getGivingJournalLinkageMock).not.toHaveBeenCalled();
  });

  it("loads journal linkage when the transaction is linked", async () => {
    const transaction = createTransaction({
      journal_entry_id: "77777777-7777-4777-8777-777777777777",
    });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingTransactionByIdMock.mockResolvedValue(transaction);

    const page = await GivingDetailPage({
      params: Promise.resolve({ id: VALID_GIVING_ID }),
    });

    expect(getGivingDebitAccountOptionsMock).not.toHaveBeenCalled();
    expect(getGivingJournalLinkageMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_GIVING_ID,
    );
    expect(page.props.journalLinkage).toEqual(createJournalLinkage());
  });

  it("does not accept organization id from client input", () => {
    const contents = readFileSync(
      path.join(process.cwd(), "src/app/(workspace)/giving/[id]/page.tsx"),
      "utf8",
    );

    expect(contents).toContain("getCurrentOrganizationId()");
    expect(contents).not.toMatch(/organizationId:\s*string/);
  });

  it("calls notFound for a missing giving transaction", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingTransactionByIdMock.mockResolvedValue(null);

    await expect(
      GivingDetailPage({
        params: Promise.resolve({ id: VALID_GIVING_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("calls notFound for an invalid UUID route parameter", async () => {
    await expect(
      GivingDetailPage({
        params: Promise.resolve({ id: "not-a-valid-uuid" }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
  });

  it("calls notFound for void giving transactions", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingTransactionByIdMock.mockResolvedValue(
      createTransaction({ status: "void" }),
    );

    await expect(
      GivingDetailPage({
        params: Promise.resolve({ id: VALID_GIVING_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
