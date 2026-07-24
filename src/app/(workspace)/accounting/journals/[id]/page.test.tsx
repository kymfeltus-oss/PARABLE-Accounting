import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalEntryDetailRecord } from "@/lib/data/journal-entry-detail-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getJournalEntryDetailMock,
  getJournalReversalEligibilityMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getJournalEntryDetailMock: vi.fn(),
  getJournalReversalEligibilityMock: vi.fn(),
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

vi.mock("@/lib/data/journal-entry-detail-repository", () => ({
  getJournalEntryDetail: getJournalEntryDetailMock,
}));

vi.mock("@/lib/data/journal-reversal-repository", () => ({
  getJournalReversalEligibility: getJournalReversalEligibilityMock,
}));

import JournalEntryDetailPage from "./page";
import { JournalEntryDetail } from "@/components/accounting/journal-entry-detail";
import { JournalReversalSection } from "@/components/accounting/journal-reversal-section";

const VALID_JOURNAL_ID = "77777777-7777-4777-8777-777777777777";
const PERIOD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createDetailRecord(
  overrides: Partial<JournalEntryDetailRecord> = {},
): JournalEntryDetailRecord {
  return {
    id: VALID_JOURNAL_ID,
    entryNumber: "MAN-TEST",
    entryDate: "2026-07-15",
    description: "Manual adjustment",
    source: "manual",
    sourceReference: null,
    periodName: "July 2026",
    status: "posted",
    lines: [
      {
        id: "line-1",
        lineNumber: 1,
        accountCode: "6100",
        accountName: "Office Supplies",
        description: "Debit line",
        debit: 125,
        credit: 0,
        fundCode: "GEN",
        fundName: "General Fund",
      },
    ],
    reversal: {
      isReversal: false,
      isReversed: false,
      relatedJournalEntryId: null,
      relatedEntryNumber: null,
      reversalDate: null,
      reversalReason: null,
    },
    ...overrides,
  };
}

describe("Journal entry detail page wiring", () => {
  beforeEach(() => {
    getCurrentOrganizationIdMock.mockReset();
    getJournalEntryDetailMock.mockReset();
    getJournalReversalEligibilityMock.mockReset();
    notFoundMock.mockClear();
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getJournalReversalEligibilityMock.mockResolvedValue({
      canReverse: false,
      reason: "This journal source type cannot be reversed.",
      periods: [],
    });
  });

  it("loads scoped detail for a valid journal id", async () => {
    const detail = createDetailRecord({ source: "expense" });
    getJournalEntryDetailMock.mockResolvedValue(detail);

    const page = await JournalEntryDetailPage({
      params: Promise.resolve({ id: VALID_JOURNAL_ID }),
    });

    expect(getJournalEntryDetailMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_JOURNAL_ID,
    );
    expect(page.type).toBe("div");
    expect(page.props.children[0].type).toBe(JournalEntryDetail);
    expect(page.props.children[0].props.entryNumber).toBe("MAN-TEST");
  });

  it("shows the reversal action for an eligible journal", async () => {
    getJournalEntryDetailMock.mockResolvedValue(createDetailRecord());
    getJournalReversalEligibilityMock.mockResolvedValue({
      canReverse: true,
      reason: null,
      periods: [
        {
          id: PERIOD_ID,
          name: "July 2026",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          isOpen: true,
        },
      ],
    });

    const page = await JournalEntryDetailPage({
      params: Promise.resolve({ id: VALID_JOURNAL_ID }),
    });

    expect(page.props.children[1].type).toBe(JournalReversalSection);
    expect(page.props.children[1].props.journalEntryId).toBe(VALID_JOURNAL_ID);
  });

  it("hides the reversal action when ineligible and shows a concise reason", async () => {
    getJournalEntryDetailMock.mockResolvedValue(
      createDetailRecord({
        status: "reversed",
        reversal: {
          isReversal: false,
          isReversed: true,
          relatedJournalEntryId: "rev-id",
          relatedEntryNumber: "REV-TEST",
          reversalDate: "2026-07-20",
          reversalReason: "Corrected allocation",
        },
      }),
    );
    getJournalReversalEligibilityMock.mockResolvedValue({
      canReverse: false,
      reason: "This journal entry has already been reversed.",
      periods: [],
    });

    const page = await JournalEntryDetailPage({
      params: Promise.resolve({ id: VALID_JOURNAL_ID }),
    });

    expect(page.props.children[1].type).toBe("p");
    expect(page.props.children[1].props.children).toBe(
      "This journal entry has already been reversed.",
    );
  });

  it("returns notFound for an invalid UUID", async () => {
    await expect(
      JournalEntryDetailPage({
        params: Promise.resolve({ id: "not-a-valid-uuid" }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
  });

  it("returns notFound when detail is missing", async () => {
    getJournalEntryDetailMock.mockResolvedValue(null);

    await expect(
      JournalEntryDetailPage({
        params: Promise.resolve({ id: VALID_JOURNAL_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("does not import browser Supabase clients", () => {
    const source = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/createBrowserSupabaseClient|@\/lib\/supabase\/browser/);
  });
});
