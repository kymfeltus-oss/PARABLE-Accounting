import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { navGroups, navItems } from "@/config/navigation";

import { AppSidebar } from "./app-sidebar";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
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

describe("AppSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an aside element", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders the primary navigation landmark with an accessible name", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
  });

  it("renders the PARABLE brand name", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(screen.getByText("PARABLE")).toBeVisible();
  });

  it("renders the Accounting product name", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    const brandName = screen.getByText("PARABLE");
    const brandBlock = brandName.parentElement;

    expect(brandBlock).not.toBeNull();
    expect(within(brandBlock!).getByText("Accounting")).toBeInTheDocument();
  });

  it("renders the Development Workspace badge", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(screen.getByText("Development Workspace")).toBeVisible();
  });

  it("renders every approved navigation group heading", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    for (const group of navGroups) {
      expect(
        screen.getByRole("heading", { name: group.label }),
      ).toBeInTheDocument();
    }
  });

  it("renders all 17 navigation links", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(screen.getAllByRole("link")).toHaveLength(17);
  });

  it("renders every link with the configured href", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    for (const item of navItems) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("marks the active route with aria-current=\"page\"", () => {
    usePathnameMock.mockReturnValue("/transactions");

    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks only one link as active for an exact pathname", () => {
    usePathnameMock.mockReturnValue("/reports");

    render(<AppSidebar />);

    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toHaveAccessibleName("Reports");
  });

  it("displays the Phase 1A footer label", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(screen.getByText("Phase 1A")).toBeVisible();
  });

  it("does not render login, user menu, or fake financial values", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$[\d,]+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/notifications/i)).not.toBeInTheDocument();
  });

  it("follows the centralized navGroups order", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    const renderedLabels = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());

    expect(renderedLabels).toEqual(
      navGroups.flatMap((group) => group.items.map((item) => item.label)),
    );
  });

  it("intends to hide below md and show at md and above", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<AppSidebar />);

    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("hidden");
    expect(aside.className).toContain("md:flex");
  });
});
