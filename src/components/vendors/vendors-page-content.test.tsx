import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyVendorsData,
  createPopulatedVendorsData,
} from "@/lib/data/test/vendors-data-fixtures";

import { VendorsPageContent } from "./vendors-page-content";

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

describe("VendorsPageContent", () => {
  it("renders the page heading", () => {
    render(<VendorsPageContent data={createEmptyVendorsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Vendors" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <VendorsPageContent data={createEmptyVendorsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<VendorsPageContent data={createEmptyVendorsData()} />);

    expect(screen.getAllByText("No vendors yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No vendor activity yet.")).toBeTruthy();
  });

  it("renders live vendor props", () => {
    render(<VendorsPageContent data={createPopulatedVendorsData()} />);

    expect(screen.getAllByText("Northside Supplies").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Total Vendors").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Active Vendors").closest("article")?.textContent,
    ).toContain("1");
    expect(screen.getByText(/Tax ID on file/)).toBeTruthy();
  });

  it("renders honest zero counts when vendors data is empty", () => {
    render(<VendorsPageContent data={createEmptyVendorsData()} />);

    expect(
      screen.getByText("Total Vendors").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Vendors With Bills").closest("article")?.textContent,
    ).toContain("0");
  });

  it("does not expose tax identifier digits in the UI", () => {
    const { container } = render(
      <VendorsPageContent data={createPopulatedVendorsData()} />,
    );

    expect(container.textContent).not.toContain("1234");
  });

  it("renders vendor financial activity from props", () => {
    render(<VendorsPageContent data={createPopulatedVendorsData()} />);

    expect(
      screen.getByRole("heading", { name: "Vendor Activity" }).closest("section")
        ?.textContent,
    ).toMatch(/\$500\.00/);
    expect(screen.queryByText("No related bills or expenses yet.")).toBeNull();
  });

  it("does not fabricate unsupported compliance or AI values", () => {
    render(<VendorsPageContent data={createPopulatedVendorsData()} />);

    expect(screen.queryByText(/1099/i)).toBeNull();
    expect(screen.queryByText(/W-9/i)).toBeNull();
    expect(screen.queryByText(/risk score/i)).toBeNull();
    expect(screen.queryByText(/AI recommendation/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<VendorsPageContent data={createEmptyVendorsData()} />);

    expect(screen.getByRole("link", { name: /Bills/i }).getAttribute("href")).toBe(
      "/bills",
    );
    expect(
      screen.getByRole("link", { name: /Expenses/i }).getAttribute("href"),
    ).toBe("/expenses");
    expect(
      screen.getByRole("link", { name: /Banking/i }).getAttribute("href"),
    ).toBe("/banking");
  });
});
