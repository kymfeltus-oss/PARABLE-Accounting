import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyDashboardData,
  createPopulatedDashboardData,
} from "@/lib/data/test/dashboard-data-fixtures";

import { DashboardPageContent } from "./dashboard-page-content";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(cleanup);

describe("DashboardPageContent", () => {
  it("renders the Financial Overview visual dashboard", () => {
    render(<DashboardPageContent data={createEmptyDashboardData()} />);
    expect(screen.getByText("Financial Overview")).toBeVisible();
    expect(screen.getByText("Giving & Expense Activity")).toBeVisible();
    expect(screen.getByText("Needs Attention")).toBeVisible();
  });

  it("renders financial values from repository props", () => {
    render(<DashboardPageContent data={createPopulatedDashboardData()} />);
    expect(screen.getAllByText("$1,250.50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$400.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$850.50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("does not fabricate unavailable cash", () => {
    render(<DashboardPageContent data={createEmptyDashboardData()} />);
    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("$184,250.00")).not.toBeInTheDocument();
  });

  it("renders live operational records and existing destinations", () => {
    render(<DashboardPageContent data={createPopulatedDashboardData()} />);
    expect(screen.getByText("Unmatched deposit")).toBeVisible();
    expect(screen.getByText("Form 990 filing")).toBeVisible();
    expect(screen.getByRole("button", { name: /Record Transaction/i })).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Create journal entry/i }),
    ).toHaveAttribute("href", "/accounting/journals/new");
    expect(screen.getByRole("link", { name: /^Bills$/i })).toHaveAttribute(
      "href",
      "/bills",
    );
    expect(screen.getByRole("link", { name: /Open Bills/i })).toHaveAttribute(
      "href",
      "/bills",
    );
    expect(screen.getByRole("link", { name: /Ask Parable/i })).toHaveAttribute("href", "/ai-close");
  });
});

