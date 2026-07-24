import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyFundsData,
  createPopulatedFundsData,
} from "@/lib/data/test/funds-data-fixtures";

import { FundsPageContent } from "./funds-page-content";

vi.mock("@/app/(workspace)/funds/actions", () => ({
  createFundAction: vi.fn(),
  updateFundAction: vi.fn(),
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

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FundsPageContent", () => {
  it("renders the page heading", () => {
    render(<FundsPageContent data={createEmptyFundsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Funds" }),
    ).toBeTruthy();
  });

  it("renders the Add Fund control", () => {
    render(<FundsPageContent data={createEmptyFundsData()} />);

    expect(screen.getByRole("button", { name: "Add Fund" })).toBeTruthy();
  });

  it("renders Edit controls for populated funds", () => {
    render(<FundsPageContent data={createPopulatedFundsData()} />);

    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <FundsPageContent data={createEmptyFundsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<FundsPageContent data={createEmptyFundsData()} />);

    expect(screen.getAllByText("No funds yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No fund activity yet.")).toBeTruthy();
  });

  it("renders live fund props", () => {
    render(<FundsPageContent data={createPopulatedFundsData()} />);

    expect(screen.getByText(/General Fund · GEN/)).toBeTruthy();
    expect(
      screen.getByText("Total Funds").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Funds With Giving").closest("article")?.textContent,
    ).toContain("1");
    expect(screen.getByText(/unrestricted · active/)).toBeTruthy();
  });

  it("renders honest zero counts when funds data is empty", () => {
    render(<FundsPageContent data={createEmptyFundsData()} />);

    expect(
      screen.getByText("Total Funds").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Funds With Budget Allocations").closest("article")
        ?.textContent,
    ).toContain("0");
  });

  it("renders ledger-derived fund balances", () => {
    render(<FundsPageContent data={createPopulatedFundsData()} />);

    expect(
      screen.getByText(/Ledger-derived fund balances as of/i),
    ).toBeTruthy();
    expect(screen.getAllByText(/Ledger balance \$850\.00/).length).toBeGreaterThan(0);
  });

  it("does not fabricate restriction compliance values", () => {
    render(<FundsPageContent data={createPopulatedFundsData()} />);

    expect(screen.queryByText(/available to spend/i)).toBeNull();
    expect(screen.queryByText(/budget variance/i)).toBeNull();
    expect(screen.queryByText(/AI recommendation/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<FundsPageContent data={createEmptyFundsData()} />);

    expect(
      screen.getByRole("link", { name: /Giving/i }).getAttribute("href"),
    ).toBe("/giving");
    expect(
      screen.getByRole("link", { name: /Expenses/i }).getAttribute("href"),
    ).toBe("/expenses");
    expect(
      screen.getByRole("link", { name: /Budgets/i }).getAttribute("href"),
    ).toBe("/budgets");
    expect(
      screen.getByRole("link", { name: /Accounting/i }).getAttribute("href"),
    ).toBe("/accounting");
  });
});
