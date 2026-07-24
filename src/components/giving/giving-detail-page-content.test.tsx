import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GivingJournalLinkage } from "@/lib/data/giving-journal-linkage";
import type { GivingTransactionRecord } from "@/lib/data/giving-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

import { GivingDetailPageContent } from "./giving-detail-page-content";

const journalLinkage: GivingJournalLinkage = {
  journalEntryId: "77777777-7777-4777-8777-777777777777",
  entryNumber: "GIV-66666666666646668666666666666666",
  entryDate: "2026-07-10",
  status: "posted",
  totalDebit: 250,
  totalCredit: 250,
  periodName: "July 2026",
  sourceReference: "CHK-1001",
};

const accountOptions = [
  {
    id: "acct-asset",
    code: "1000",
    name: "Operating Checking",
    accountType: "asset" as const,
    displayLabel: "1000 — Operating Checking",
  },
];

vi.mock("@/components/giving/record-giving-section", () => ({
  RecordGivingSection: ({
    transactionLabel,
  }: {
    transactionLabel: string;
  }) => (
    <section aria-label="Record giving section">
      <p>{transactionLabel}</p>
    </section>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createTransaction(
  overrides: Partial<GivingTransactionRecord> = {},
): GivingTransactionRecord {
  return {
    id: "gift-1",
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

function renderDetailPage(
  transaction: GivingTransactionRecord,
  options: {
    journalLinkage?: GivingJournalLinkage | null;
  } = {},
) {
  return render(
    <GivingDetailPageContent
      debitAccountOptions={accountOptions}
      journalLinkage={options.journalLinkage ?? null}
      revenueAccountOptions={accountOptions}
      transaction={transaction}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("GivingDetailPageContent", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the transaction reference as the page title", () => {
    renderDetailPage(createTransaction());

    expect(
      screen.getByRole("heading", { level: 1, name: "CHK-1001" }),
    ).toBeTruthy();
  });

  it("renders the back link pointing to /giving", () => {
    renderDetailPage(createTransaction());

    expect(
      screen.getByRole("link", { name: "Back to giving" }).getAttribute("href"),
    ).toBe("/giving");
  });

  it("renders the record giving section when eligible", () => {
    renderDetailPage(createTransaction());

    expect(screen.getByLabelText("Record giving section")).toBeTruthy();
  });

  it("does not render the record giving section when already linked", () => {
    renderDetailPage(
      createTransaction({
        journal_entry_id: journalLinkage.journalEntryId,
      }),
      { journalLinkage },
    );

    expect(screen.queryByLabelText("Record giving section")).toBeNull();
  });

  it("renders the journal panel when linkage exists", () => {
    renderDetailPage(
      createTransaction({
        journal_entry_id: journalLinkage.journalEntryId,
      }),
      { journalLinkage },
    );

    expect(screen.getByText("Journal Entry")).toBeTruthy();
    expect(
      within(
        screen.getByRole("heading", { name: "Journal Entry" }).closest("section")!,
      ).getByTestId("journal-entry-number"),
    ).toHaveTextContent("GIV-66666666666646668666666666666666");
  });
});
