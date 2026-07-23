import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalEntryDetailRecord } from "@/lib/data/journal-entry-detail-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getJournalEntryDetailMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getJournalEntryDetailMock: vi.fn(),
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

import JournalEntryDetailPage from "./page";
import { JournalEntryDetail } from "@/components/accounting/journal-entry-detail";

const VALID_JOURNAL_ID = "77777777-7777-4777-8777-777777777777";

function createDetailRecord(): JournalEntryDetailRecord {
  return {
    id: VALID_JOURNAL_ID,
    entryNumber: "JE-2026-0042",
    entryDate: "2026-07-23",
    description: "Recorded community outreach expense",
    source: "expense",
    sourceReference: "EXP-1042",
    periodName: "July 2026",
    status: "posted",
    lines: [
      {
        id: "line-1",
        lineNumber: 1,
        accountCode: "5100",
        accountName: "Community Outreach Expense",
        description: "Outreach supplies",
        debit: 1250.5,
        credit: 0,
        fundCode: "GEN",
        fundName: "General Fund",
      },
    ],
  };
}

describe("Journal entry detail page wiring", () => {
  beforeEach(() => {
    getCurrentOrganizationIdMock.mockReset();
    getJournalEntryDetailMock.mockReset();
    notFoundMock.mockClear();
  });

  it("loads scoped detail for a valid journal id", async () => {
    const detail = createDetailRecord();
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getJournalEntryDetailMock.mockResolvedValue(detail);

    const page = await JournalEntryDetailPage({
      params: Promise.resolve({ id: VALID_JOURNAL_ID }),
    });

    expect(getJournalEntryDetailMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_JOURNAL_ID,
    );
    expect(page.type).toBe(JournalEntryDetail);
    expect(page.props.entryNumber).toBe("JE-2026-0042");
    expect(page.props.lines).toHaveLength(1);
    expect(page.props.lines[0]?.accountCode).toBe("5100");
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

  it("returns notFound when the scoped journal is missing", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getJournalEntryDetailMock.mockResolvedValue(null);

    await expect(
      JournalEntryDetailPage({
        params: Promise.resolve({ id: VALID_JOURNAL_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organization id from client input", () => {
    const contents = readFileSync(
      path.join(
        process.cwd(),
        "src/app/(workspace)/accounting/journals/[id]/page.tsx",
      ),
      "utf8",
    );

    expect(contents).toContain("getCurrentOrganizationId()");
    expect(contents).not.toMatch(/organizationId:\s*string/);
  });
});
