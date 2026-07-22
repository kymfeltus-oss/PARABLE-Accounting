import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { getNavItemByPathname } from "@/config/navigation";

import { AppHeader } from "./app-header";

describe("AppHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a semantic header element", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("displays Dashboard for /dashboard", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: getNavItemByPathname("/dashboard")!.title,
      }),
    ).toBeVisible();
  });

  it("displays AI Close for /ai-close", () => {
    usePathnameMock.mockReturnValue("/ai-close");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: getNavItemByPathname("/ai-close")!.title,
      }),
    ).toHaveTextContent("AI Close");
  });

  it("displays Audit Vault for /audit-vault", () => {
    usePathnameMock.mockReturnValue("/audit-vault");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: getNavItemByPathname("/audit-vault")!.title,
      }),
    ).toHaveTextContent("Audit Vault");
  });

  it("displays Parable Accounting for an unknown pathname", () => {
    usePathnameMock.mockReturnValue("/unknown-route");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Parable Accounting" }),
    ).toBeVisible();
  });

  it("renders the Development Workspace badge", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(screen.getByText("Development Workspace")).toBeVisible();
  });

  it("renders the mobile menu button with an accessible name", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeInTheDocument();
  });

  it("calls onOpenMobileNav exactly once when the menu button is selected", async () => {
    usePathnameMock.mockReturnValue("/dashboard");
    const user = userEvent.setup();
    const onOpenMobileNav = vi.fn();

    render(<AppHeader onOpenMobileNav={onOpenMobileNav} />);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it("renders the menu icon", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });

    expect(menuButton.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render login, user menu, or fake financial values", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/notifications/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$[\d,]+/)).not.toBeInTheDocument();
  });

  it("derives the title from centralized navigation configuration", () => {
    usePathnameMock.mockReturnValue("/reports");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: getNavItemByPathname("/reports")!.title,
      }),
    ).toBeVisible();
  });

  it("renders the sign-out control in the header actions region", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    const actionRegion = screen.getByLabelText("Header actions");

    expect(actionRegion).toBeInTheDocument();
    expect(
      within(actionRegion).getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("intends to hide the menu button at md and above", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppHeader onOpenMobileNav={vi.fn()} />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    expect(menuButton.className).toContain("md:hidden");
  });
});
