import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyExceptionsData,
  createPopulatedExceptionsData,
} from "@/lib/data/test/exceptions-data-fixtures";

import { ExceptionsPageContent } from "./exceptions-page-content";

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

describe("ExceptionsPageContent", () => {
  it("renders the page heading", () => {
    render(<ExceptionsPageContent data={createEmptyExceptionsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Exceptions" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <ExceptionsPageContent data={createEmptyExceptionsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<ExceptionsPageContent data={createEmptyExceptionsData()} />);

    expect(screen.getAllByText("No exceptions yet.").length).toBeGreaterThan(0);
  });

  it("renders live exception props", () => {
    render(<ExceptionsPageContent data={createPopulatedExceptionsData()} />);

    expect(screen.getByText("Unmatched bank deposit")).toBeTruthy();
    expect(
      screen.getByText("High Severity Exceptions").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Open Exceptions").closest("article")?.textContent,
    ).toContain("1");
  });

  it("renders honest zero counts when exceptions data is empty", () => {
    render(<ExceptionsPageContent data={createEmptyExceptionsData()} />);

    expect(
      screen.getByText("Total Exceptions").closest("article")?.textContent,
    ).toContain("0");
  });

  it("filters exceptions by schema-backed status", () => {
    render(<ExceptionsPageContent data={createPopulatedExceptionsData()} />);

    fireEvent.click(screen.getByRole("button", { name: "Resolved" }));

    const table = screen.getByRole("table");
    expect(table.textContent).toContain("Unbalanced journal entry");
    expect(table.textContent).not.toContain("Unmatched bank deposit");
  });

  it("filters exceptions by search text", () => {
    render(<ExceptionsPageContent data={createPopulatedExceptionsData()} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "duplicate" },
    });

    expect(screen.getByText("Duplicate expense detected")).toBeTruthy();
    expect(screen.queryByText("Unmatched bank deposit")).toBeNull();
  });

  it("states automated remediation is unavailable", () => {
    render(<ExceptionsPageContent data={createPopulatedExceptionsData()} />);

    expect(
      screen.getByText(/Exceptions shown here reflect recorded items in the current accounting data model/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Automated remediation and AI-generated resolution decisions are not implemented/i),
    ).toBeTruthy();
  });

  it("does not fabricate remediation actions or discrepancy totals", () => {
    const { container } = render(
      <ExceptionsPageContent data={createPopulatedExceptionsData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/auto-resolve|remediate now|amount discrepancy total/i);
  });

  it("renders related workspace navigation links", () => {
    render(<ExceptionsPageContent data={createEmptyExceptionsData()} />);

    expect(screen.getByRole("link", { name: /Banking/i })).toHaveAttribute(
      "href",
      "/banking",
    );
    expect(screen.getByRole("link", { name: /Transactions/i })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });
});
