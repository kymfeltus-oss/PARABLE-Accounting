import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getNavItemByPathname } from "@/config/navigation";

import { NavLink } from "./nav-link";

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

describe("NavLink", () => {
  const item = getNavItemByPathname("/dashboard")!;

  afterEach(() => {
    cleanup();
  });

  it("renders the label", () => {
    usePathnameMock.mockReturnValue("/giving");

    render(<NavLink item={item} />);

    expect(
      screen.getByRole("link", { name: item.label }),
    ).toBeInTheDocument();
  });

  it("renders the link with the correct href", () => {
    usePathnameMock.mockReturnValue("/giving");

    render(<NavLink item={item} />);

    expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
      "href",
      item.href,
    );
  });

  it("renders the icon", () => {
    usePathnameMock.mockReturnValue("/giving");

    const { container } = render(<NavLink item={item} />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it('sets aria-current="page" when the pathname exactly matches', () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(<NavLink item={item} />);

    expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not set aria-current when the pathname does not match", () => {
    usePathnameMock.mockReturnValue("/giving");

    render(<NavLink item={item} />);

    expect(
      screen.getByRole("link", { name: item.label }),
    ).not.toHaveAttribute("aria-current");
  });

  it("does not activate the item for a nested pathname", () => {
    usePathnameMock.mockReturnValue("/dashboard/reports");

    render(<NavLink item={item} />);

    expect(
      screen.getByRole("link", { name: item.label }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("calls onNavigate when the user selects the link", async () => {
    usePathnameMock.mockReturnValue("/giving");
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<NavLink item={item} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("link", { name: item.label }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("is keyboard focusable", async () => {
    usePathnameMock.mockReturnValue("/giving");
    const user = userEvent.setup();

    render(<NavLink item={item} />);

    await user.tab();

    expect(screen.getByRole("link", { name: item.label })).toHaveFocus();
  });

  it("renders the icon and label accessibly in compact mode", () => {
    usePathnameMock.mockReturnValue("/giving");

    render(<NavLink item={item} compact />);

    expect(
      screen.getByRole("link", { name: item.label }),
    ).toBeInTheDocument();
    expect(screen.getByText(item.label)).toBeVisible();
  });
});
