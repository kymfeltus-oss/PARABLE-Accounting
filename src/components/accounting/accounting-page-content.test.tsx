import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyAccountingData,
  createPopulatedAccountingData,
} from "@/lib/data/test/accounting-data-fixtures";

import { AccountingPageContent } from "./accounting-page-content";

vi.mock("@/app/(workspace)/accounting/actions", () => ({
  createAccountAction: vi.fn(),
  createAccountingPeriodAction: vi.fn(),
  closeAccountingPeriodAction: vi.fn(),
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccountingPageContent", () => {
  it("renders the page heading", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Accounting" }),
    ).toBeTruthy();
  });

  it("renders the Add Account control", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(screen.getByRole("button", { name: "Add Account" })).toBeTruthy();
  });

  it("links to the new manual journal entry page", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    const createJournalLinks = screen.getAllByRole("link", {
      name: "Create journal entry",
    });

    expect(createJournalLinks.length).toBeGreaterThan(0);
    for (const link of createJournalLinks) {
      expect(link).toHaveAttribute("href", "/accounting/journals/new");
    }
  });

  it("links to the journal register", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(
      screen.getByRole("link", { name: "View journal register" }),
    ).toHaveAttribute("href", "/accounting/journals");
    expect(
      screen.getByRole("link", {
        name: /Journal registerBrowse and filter all journal entries/i,
      }),
    ).toHaveAttribute("href", "/accounting/journals");
  });

  it("renders the Add Period control", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(screen.getByRole("button", { name: "Add Period" })).toBeTruthy();
  });

  it("renders Close Period controls for open periods", () => {
    render(<AccountingPageContent data={createPopulatedAccountingData()} />);

    expect(screen.getByRole("button", { name: "Close Period" })).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <AccountingPageContent data={createEmptyAccountingData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(screen.getAllByText("No accounting records yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No accounts yet.")).toBeTruthy();
    expect(screen.getByText("No accounting periods yet.")).toBeTruthy();
    expect(screen.getByText("No journal entries yet.")).toBeTruthy();
  });

  it("renders live accounting props", () => {
    const data = createPopulatedAccountingData();
    render(<AccountingPageContent data={data} />);

    expect(screen.getAllByText(/1000 · Operating Cash/).length).toBeGreaterThan(0);
    expect(screen.getByText(/JE-1001/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /JE-1001/ }),
    ).toHaveAttribute(
      "href",
      `/accounting/journals/${data.journalEntries[0]?.id}`,
    );
    expect(screen.getByText("July 2026")).toBeTruthy();
    expect(
      screen.getByText("Total Accounts").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Posted Journal Entries").closest("article")?.textContent,
    ).toContain("1");
  });

  it("renders honest zero counts when accounting data is empty", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(
      screen.getByText("Total Accounts").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Draft Journal Entries").closest("article")?.textContent,
    ).toContain("0");
  });

  it("renders trial balance and account balances from posted activity", () => {
    render(<AccountingPageContent data={createPopulatedAccountingData()} />);

    expect(screen.getByRole("heading", { name: "Trial Balance" })).toBeTruthy();
    expect(screen.getAllByText(/Balance \$150\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1000 · Operating Cash/).length).toBeGreaterThan(0);
  });

  it("does not fabricate export functionality", () => {
    const { container } = render(
      <AccountingPageContent data={createPopulatedAccountingData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/export|download|pdf|csv/i);
  });

  it("renders unbalanced journal entries honestly", () => {
    render(<AccountingPageContent data={createPopulatedAccountingData()} />);

    expect(screen.getByText(/Unbalanced/)).toBeTruthy();
    expect(screen.getByText(/Debits \$200\.00 · Credits \$100\.00/)).toBeTruthy();
  });

  it("renders related workspace navigation links", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(screen.getByRole("link", { name: /Transactions/i })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: /Funds/i })).toHaveAttribute(
      "href",
      "/funds",
    );
    expect(screen.getByRole("link", { name: /Budgets/i })).toHaveAttribute(
      "href",
      "/budgets",
    );
    expect(screen.getByRole("link", { name: /Reports/i })).toHaveAttribute(
      "href",
      "/reports",
    );
  });
});
