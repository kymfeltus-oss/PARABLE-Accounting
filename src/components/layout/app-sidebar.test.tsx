import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { navItems } from "@/config/navigation";

import { AppSidebar, sidebarItems } from "./app-sidebar";

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

const identity = {
  organizationName: "Grace Community Church",
  userDisplayName: "Taylor Reed",
  userEmail: "taylor@example.org",
};

afterEach(cleanup);

describe("AppSidebar", () => {
  it("renders every navigation link from centralized config", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<AppSidebar identity={identity} />);

    expect(screen.getAllByRole("link")).toHaveLength(navItems.length);
    expect(sidebarItems).toEqual(navItems);
  });

  it("uses the configured hrefs and marks Dashboard active", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<AppSidebar identity={identity} />);

    for (const item of sidebarItems) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders brand and live workspace identity without fake status claims", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<AppSidebar identity={identity} />);

    expect(screen.getByText("PARABLE")).toBeVisible();
    expect(screen.getByText("Ministry Finance OS")).toBeVisible();
    expect(screen.getByText("Grace Community Church")).toBeVisible();
    expect(screen.getByText("Organization")).toBeVisible();
    expect(screen.getByText("Taylor Reed")).toBeVisible();
    expect(screen.getByText("taylor@example.org")).toBeVisible();
    expect(screen.queryByText("Development")).not.toBeInTheDocument();
    expect(screen.queryByText("Kym Feltus")).not.toBeInTheDocument();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("All systems operational")).not.toBeInTheDocument();
    expect(screen.queryByText(/Last synced/i)).not.toBeInTheDocument();
  });
});
