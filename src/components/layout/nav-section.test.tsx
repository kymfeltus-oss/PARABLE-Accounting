import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { navGroups } from "@/config/navigation";

import { NavSection } from "./nav-section";

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

describe("NavSection", () => {
  const group = navGroups.find((entry) => entry.id === "giving-members")!;

  beforeEach(() => {
    usePathnameMock.mockReturnValue("/members");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the group heading", () => {
    render(<NavSection group={group} />);

    expect(
      screen.getByRole("heading", { name: group.label }),
    ).toBeInTheDocument();
  });

  it("renders every item in the group", () => {
    render(<NavSection group={group} />);

    for (const item of group.items) {
      expect(
        screen.getByRole("link", { name: item.label }),
      ).toBeInTheDocument();
    }
  });

  it("renders the correct number of list items", () => {
    render(<NavSection group={group} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(group.items.length);
  });

  it("renders every link with the configured href", () => {
    render(<NavSection group={group} />);

    for (const item of group.items) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("passes onNavigate through to child links", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<NavSection group={group} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("link", { name: group.items[0].label }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("passes compact mode through without removing accessible labels", () => {
    render(<NavSection group={group} compact />);

    for (const item of group.items) {
      expect(
        screen.getByRole("link", { name: item.label }),
      ).toBeInTheDocument();
      expect(screen.getByText(item.label)).toBeVisible();
    }
  });
});
