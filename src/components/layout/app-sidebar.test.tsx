import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppSidebar, sidebarItems } from "./app-sidebar";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(cleanup);

describe("AppSidebar", () => {
  it("renders the approved navigation in exact order", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<AppSidebar />);
    expect(screen.getAllByRole("link").map((link) => link.textContent?.trim())).toEqual([
      "Overview", "Giving", "Expenses", "Vendors", "Banking",
      "Accounting", "Reports", "Compliance", "Members", "Settings",
    ]);
  });

  it("uses the configured hrefs and marks Overview active", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<AppSidebar />);
    for (const item of sidebarItems) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the approved brand, organization, profile, and status content", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<AppSidebar />);
    expect(screen.getByText("PARABLE")).toBeVisible();
    expect(screen.getByText("Ministry Finance OS")).toBeVisible();
    expect(screen.getByText("Parable Accounting")).toBeVisible();
    expect(screen.getByText("Development")).toBeVisible();
    expect(screen.getByText("Kym Feltus")).toBeVisible();
    expect(screen.getByText("Owner")).toBeVisible();
    expect(screen.getByText("All systems operational")).toBeVisible();
  });
});
