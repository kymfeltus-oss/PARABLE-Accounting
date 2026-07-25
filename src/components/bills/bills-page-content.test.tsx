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

vi.mock("@/app/(workspace)/bills/actions", () => ({
  createBillAction: vi.fn(),
  openBillAction: vi.fn(),
  payBillAction: vi.fn(),
  voidBillAction: vi.fn(),
}));

const emptyFormProps = {
  vendorOptions: [],
  expenseAccountOptions: [],
  cashAccountOptions: [],
  fundOptions: [],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BillsPageContent", () => {
  it("renders the page heading", () => {
    render(<BillsPageContent data={createEmptyBillsData()} {...emptyFormProps} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bills" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <BillsPageContent data={createEmptyBillsData()} {...emptyFormProps} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<BillsPageContent data={createEmptyBillsData()} {...emptyFormProps} />);

    expect(
      screen.getByText(/Add a vendor first, then come back to create payables/i),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Go to Vendors" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Add a vendor first" }),
    ).toHaveAttribute("href", "/vendors");
    expect(screen.getByText("No overdue bills.")).toBeTruthy();
  });

  it("points users to New Bill when vendors exist but bills do not", () => {
    render(
      <BillsPageContent
        data={createEmptyBillsData()}
        {...emptyFormProps}
        vendorOptions={[{ id: "vendor-1", name: "Northside Supplies" }]}
      />,
    );

    expect(
      screen.getAllByText(/No bills yet. Use New Bill to create your first payable/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /New Bill/i })).toBeTruthy();
  });

  it("renders live bill props", () => {
    render(<BillsPageContent data={createPopulatedBillsData()} {...emptyFormProps} />);

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
    render(<BillsPageContent data={createEmptyBillsData()} {...emptyFormProps} />);

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

    render(<BillsPageContent data={createPopulatedBillsData()} {...emptyFormProps} />);

    expect(
      screen.getByRole("heading", { name: "Needs Attention" }).closest("section")
        ?.textContent,
    ).toMatch(/City Utilities/);
    expect(screen.queryByText("No overdue bills.")).toBeNull();
  });

  it("does not fabricate remaining balances or approval workflow labels", () => {
    render(<BillsPageContent data={createPopulatedBillsData()} {...emptyFormProps} />);

    expect(screen.queryByText(/remaining balance/i)).toBeNull();
    expect(screen.queryByText(/approval/i)).toBeNull();
    expect(screen.queryByText(/AI risk/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<BillsPageContent data={createEmptyBillsData()} {...emptyFormProps} />);

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/vendors");
    expect(hrefs).toContain("/expenses");
    expect(hrefs).toContain("/banking");
  });
});
