import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { ManualJournalOptions } from "@/lib/data/manual-journal-options";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getManualJournalOptionsMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getManualJournalOptionsMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/manual-journal-options", () => ({
  getManualJournalOptions: getManualJournalOptionsMock,
}));

vi.mock("@/components/accounting/manual-journal-entry-section", () => ({
  ManualJournalEntrySection: ({
    accounts,
    funds,
    periods,
  }: ManualJournalOptions) => (
    <section aria-label="Manual journal entry section">
      <p data-testid="account-count">{accounts.length}</p>
      <p data-testid="fund-count">{funds.length}</p>
      <p data-testid="period-count">{periods.length}</p>
    </section>
  ),
}));

vi.mock("@/components/workspace/workspace-data-empty", () => ({
  WorkspaceDataEmpty: ({ message }: { message: string }) => (
    <p role="status">{message}</p>
  ),
}));

import NewManualJournalPage from "./page";

function createOptions(
  overrides: Partial<ManualJournalOptions> = {},
): ManualJournalOptions {
  return {
    accounts: [
      { id: "account-1", code: "1000", name: "Cash" },
      { id: "account-2", code: "5000", name: "Expense" },
    ],
    funds: [{ id: "fund-1", code: "GEN", name: "General Fund" }],
    periods: [
      {
        id: "period-1",
        name: "July 2026",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        isOpen: true,
      },
    ],
    ...overrides,
  };
}

function getSection(page: Awaited<ReturnType<typeof NewManualJournalPage>>) {
  const children = Array.isArray(page.props.children)
    ? page.props.children
    : [page.props.children];

  return children.find(
    (child) =>
      child &&
      typeof child === "object" &&
      "props" in child &&
      Array.isArray((child as { props?: { accounts?: unknown } }).props?.accounts),
  ) as React.ReactElement | undefined;
}

describe("New manual journal page wiring", () => {
  it("loads organization-scoped manual journal options server-side", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getManualJournalOptionsMock.mockResolvedValue(createOptions());

    await NewManualJournalPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getManualJournalOptionsMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
    );
  });

  it("passes serializable option props into the client section", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getManualJournalOptionsMock.mockResolvedValue(createOptions());

    const page = await NewManualJournalPage();
    const section = getSection(page);

    expect(section?.props.accounts).toHaveLength(2);
    expect(section?.props.funds).toHaveLength(1);
    expect(section?.props.periods).toHaveLength(1);
  });

  it("renders an empty-state message when option loading fails", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getManualJournalOptionsMock.mockRejectedValue(new Error("load failed"));

    const page = await NewManualJournalPage();
    const children = Array.isArray(page.props.children)
      ? page.props.children
      : [page.props.children];
    const emptyState = children.find(
      (child) =>
        child &&
        typeof child === "object" &&
        "props" in child &&
        (child as { props?: { message?: string } }).props?.message?.includes(
          "could not be loaded",
        ),
    );

    expect(emptyState).toBeDefined();
  });

  it("does not accept organization id from client input", () => {
    const contents = readFileSync(
      path.join(
        process.cwd(),
        "src/app/(workspace)/accounting/journals/new/page.tsx",
      ),
      "utf8",
    );

    expect(contents).toContain("getCurrentOrganizationId()");
    expect(contents).not.toMatch(/organizationId:\s*string/);
  });
});
