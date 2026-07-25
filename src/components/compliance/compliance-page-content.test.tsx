import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyComplianceData,
  createPopulatedComplianceData,
} from "@/lib/data/test/compliance-data-fixtures";

import { CompliancePageContent } from "./compliance-page-content";

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

describe("CompliancePageContent", () => {
  it("renders the page heading", () => {
    render(<CompliancePageContent data={createEmptyComplianceData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Compliance" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <CompliancePageContent data={createEmptyComplianceData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<CompliancePageContent data={createEmptyComplianceData()} />);

    expect(
      screen.getAllByText("No compliance items yet.").length,
    ).toBeGreaterThan(0);
  });

  it("renders live compliance props", () => {
    render(<CompliancePageContent data={createPopulatedComplianceData()} />);

    expect(screen.getByText("Form 990 filing")).toBeTruthy();
    expect(screen.getAllByText("federal tax").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Open Items").closest("article")?.textContent,
    ).toContain("2");
  });

  it("renders honest zero counts when compliance data is empty", () => {
    render(<CompliancePageContent data={createEmptyComplianceData()} />);

    expect(
      screen.getByText("Total Compliance Items").closest("article")?.textContent,
    ).toContain("0");
  });

  it("filters compliance items by schema-backed status", () => {
    render(<CompliancePageContent data={createPopulatedComplianceData()} />);

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));

    const table = screen.getByRole("table");
    expect(table.textContent).toContain("State charity registration");
    expect(table.textContent).not.toContain("Form 990 filing");
  });

  it("filters compliance items by search text", () => {
    render(<CompliancePageContent data={createPopulatedComplianceData()} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "payroll" },
    });

    expect(screen.getByText("Legacy payroll filing")).toBeTruthy();
    expect(screen.queryByText("Form 990 filing")).toBeNull();
  });

  it("states external filing integrations are unavailable", () => {
    render(<CompliancePageContent data={createPopulatedComplianceData()} />);

    expect(
      screen.getByText(/External filing integrations and automated compliance scoring are unavailable/i),
    ).toBeTruthy();
  });

  it("does not fabricate compliance scores or filing actions", () => {
    const { container } = render(
      <CompliancePageContent data={createPopulatedComplianceData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/compliance score|file now|submit filing/i);
  });

  it("renders related workspace navigation links", () => {
    render(<CompliancePageContent data={createEmptyComplianceData()} />);

    expect(screen.getByRole("link", { name: /Period Close/i })).toHaveAttribute(
      "href",
      "/ai-close",
    );
    expect(screen.getByRole("link", { name: /Exceptions/i })).toHaveAttribute(
      "href",
      "/exceptions",
    );
  });
});
