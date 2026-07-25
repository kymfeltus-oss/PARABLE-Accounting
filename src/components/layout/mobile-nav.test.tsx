import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { navGroups, navItems } from "@/config/navigation";

import { MobileNav } from "./mobile-nav";

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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("MobileNav", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    usePathnameMock.mockReturnValue("/dashboard");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not show drawer content when closed", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Primary navigation" }),
    ).not.toBeInTheDocument();
  });

  it("shows the drawer when open", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("renders the accessible sheet title", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Parable Accounting navigation" }),
    ).toBeInTheDocument();
  });

  it("renders the accessible sheet description", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(
      screen.getByText(
        "Mobile navigation menu for Parable Accounting workspace sections.",
      ),
    ).toBeInTheDocument();
  });

  it("renders PARABLE in the brand area", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("PARABLE")).toBeVisible();
  });

  it("renders Accounting in the brand area using a scoped query", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    const brandName = screen.getByText("PARABLE");
    const brandBlock = brandName.parentElement;

    expect(brandBlock).not.toBeNull();
    expect(within(brandBlock!).getByText("Accounting")).toBeInTheDocument();
  });

  it("renders the live organization name instead of a Development Workspace badge", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Grace Community Church")).toBeVisible();
    expect(screen.queryByText("Development Workspace")).not.toBeInTheDocument();
  });

  it("renders every approved navigation group heading", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    for (const group of navGroups) {
      expect(
        screen.getByRole("heading", { name: group.label }),
      ).toBeInTheDocument();
    }
  });

  it("renders all 17 navigation links", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getAllByRole("link")).toHaveLength(17);
  });

  it("renders every link with the configured href", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    for (const item of navItems) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("marks the active route with aria-current=\"page\"", () => {
    usePathnameMock.mockReturnValue("/members");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("calls onOpenChange(false) when a navigation link is selected", async () => {
    usePathnameMock.mockReturnValue("/dashboard");
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("link", { name: "Giving" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the signed-in user in the footer instead of a phase label", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Taylor Reed")).toBeVisible();
    expect(screen.getByText("taylor@example.org")).toBeVisible();
    expect(screen.queryByText("Phase 1A")).not.toBeInTheDocument();
  });

  it("does not render login, user menu, or fake financial values", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<MobileNav identity={{ organizationName: "Grace Community Church", userDisplayName: "Taylor Reed", userEmail: "taylor@example.org" }} open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/log in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$[\d,]+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/notifications/i)).not.toBeInTheDocument();
  });
});
