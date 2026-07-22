import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { navItems } from "@/config/navigation";
import type { NavItemId } from "@/config/navigation";

import { WorkspacePage } from "./workspace-page";

function configuredItem(navId: NavItemId) {
  const navItem = navItems.find((item) => item.id === navId);

  if (!navItem) {
    throw new Error(`Missing test navigation item for navId: ${navId}`);
  }

  return navItem;
}

afterEach(() => {
  cleanup();
});

describe("WorkspacePage", () => {
  it("renders the configured Dashboard title and description", () => {
    const dashboard = configuredItem("dashboard");

    render(<WorkspacePage navId="dashboard" />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText(dashboard.description)).toBeTruthy();
  });

  it("renders the configured Giving title and description", () => {
    const giving = configuredItem("giving");

    render(<WorkspacePage navId="giving" />);

    expect(screen.getByRole("heading", { level: 1, name: "Giving" })).toBeTruthy();
    expect(screen.getByText(giving.description)).toBeTruthy();
  });

  it("renders configured titles for AI Close and Audit Vault", () => {
    render(<WorkspacePage navId="ai-close" />);
    expect(screen.getByRole("heading", { level: 1, name: "AI Close" })).toBeTruthy();

    cleanup();

    render(<WorkspacePage navId="audit-vault" />);
    expect(screen.getByRole("heading", { level: 1, name: "Audit Vault" })).toBeTruthy();
  });

  it("renders the approved empty state and development phase label", () => {
    render(<WorkspacePage navId="dashboard" />);

    expect(
      screen.getByText(
        "This workspace section is not yet configured. Live ministry financial data and workflows will appear here in a future implementation phase.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Phase 1A")).toBeTruthy();
  });

  it("renders exactly one level-one heading", () => {
    render(<WorkspacePage navId="dashboard" />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("does not render links, buttons, tables, charts, or SVG visualizations", () => {
    const { container } = render(<WorkspacePage navId="dashboard" />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("table")).toHaveLength(0);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("does not render fake financial, account, notification, or search content", () => {
    const { container } = render(<WorkspacePage navId="dashboard" />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/\$\s?\d|\b\d+\.\d{2}\b/);
    expect(text).not.toMatch(/log in|login|log out|logout|sign up|signup/i);
    expect(text).not.toMatch(/user profile|notifications?|search/i);
  });

  it("derives page title and description from centralized navigation", () => {
    const dashboard = configuredItem("dashboard");

    render(<WorkspacePage navId="dashboard" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      dashboard.title,
    );
    expect(screen.getByText(dashboard.description)).toBeTruthy();
  });
});
