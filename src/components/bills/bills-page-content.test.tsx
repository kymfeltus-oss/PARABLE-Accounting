import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyBillsData,
  createPopulatedBillsData,
} from "@/lib/data/test/bills-data-fixtures";

import { BillsPageContent } from "./bills-page-content";

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
  vi.useRealTimers();
});

describe("BillsPageContent", () => {
  it("renders the page heading", () => {
    render(<BillsPageContent data={createEmptyBillsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bills" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <BillsPageContent data={createEmptyBillsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<BillsPageContent data={createEmptyBillsData()} />);

    expect(screen.getAllByText("No bills yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No overdue bills.")).toBeTruthy();
  });

  it("renders live bill props", () => {
    render(<BillsPageContent data={createPopulatedBillsData()} />);

    expect(screen.getByText(/Northside Supplies · INV-1001/)).toBeTruthy();
    expect(
      screen.getByText("Total Bills").closest("article")?.textContent,
    ).toContain("3");
    expect(
      screen.getByText("Open Bills").closest("article")?.textContent,
    ).toContain("2");
    expect(screen.getByText(/Open payables total:/)).toBeTruthy();
  });

  it("renders honest zero counts when bills data is empty", () => {
    render(<BillsPageContent data={createEmptyBillsData()} />);

    expect(
      screen.getByText("Total Bills").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Open Bills").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Overdue Bills").closest("article")?.textContent,
    ).toContain("0");
  });

  it("renders overdue bills in the attention area when props include overdue items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    render(<BillsPageContent data={createPopulatedBillsData()} />);

    expect(
      screen.getByRole("heading", { name: "Needs Attention" }).closest("section")
        ?.textContent,
    ).toMatch(/City Utilities/);
    expect(screen.queryByText("No overdue bills.")).toBeNull();
  });

  it("does not fabricate remaining balances or approval workflow labels", () => {
    render(<BillsPageContent data={createPopulatedBillsData()} />);

    expect(screen.queryByText(/remaining balance/i)).toBeNull();
    expect(screen.queryByText(/approval/i)).toBeNull();
    expect(screen.queryByText(/AI risk/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<BillsPageContent data={createEmptyBillsData()} />);

    expect(screen.getByRole("link", { name: /Vendors/i }).getAttribute("href")).toBe(
      "/vendors",
    );
    expect(
      screen.getByRole("link", { name: /Expenses/i }).getAttribute("href"),
    ).toBe("/expenses");
    expect(screen.getByRole("link", { name: /Banking/i }).getAttribute("href")).toBe(
      "/banking",
    );
  });
});
