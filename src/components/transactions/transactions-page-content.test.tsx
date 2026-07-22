import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyTransactionsData,
  createPopulatedTransactionsData,
} from "@/lib/data/test/transactions-data-fixtures";

import { TransactionsPageContent } from "./transactions-page-content";

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

afterEach(() => {
  cleanup();
});

describe("TransactionsPageContent", () => {
  it("renders the page heading", () => {
    render(<TransactionsPageContent data={createEmptyTransactionsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Transactions" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <TransactionsPageContent data={createEmptyTransactionsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<TransactionsPageContent data={createEmptyTransactionsData()} />);

    expect(screen.getAllByText("No transactions yet.").length).toBeGreaterThan(0);
  });

  it("renders live transaction props", () => {
    render(<TransactionsPageContent data={createPopulatedTransactionsData()} />);

    expect(screen.getByText(/Deposit from offering/)).toBeTruthy();
    expect(
      screen.getByText("Total Transactions").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Unmatched").closest("article")?.textContent,
    ).toContain("1");
    expect(screen.getByText(/expenses · confirmed/)).toBeTruthy();
  });

  it("renders honest zero counts when transactions data is empty", () => {
    render(<TransactionsPageContent data={createEmptyTransactionsData()} />);

    expect(
      screen.getByText("Total Transactions").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Unmatched").closest("article")?.textContent,
    ).toContain("0");
  });

  it("does not fabricate unsupported attention metrics", () => {
    render(<TransactionsPageContent data={createPopulatedTransactionsData()} />);

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText(/AI match/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<TransactionsPageContent data={createEmptyTransactionsData()} />);

    expect(screen.getByRole("link", { name: /Banking/i }).getAttribute("href")).toBe(
      "/banking",
    );
    expect(screen.getByRole("link", { name: /Bills/i }).getAttribute("href")).toBe(
      "/bills",
    );
    expect(
      screen.getByRole("link", { name: /Expenses/i }).getAttribute("href"),
    ).toBe("/expenses");
    expect(
      screen.getByRole("link", { name: /Accounting/i }).getAttribute("href"),
    ).toBe("/accounting");
  });
});
