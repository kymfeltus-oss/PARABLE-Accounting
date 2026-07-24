import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyMembersData,
  createPopulatedMembersData,
} from "@/lib/data/test/members-data-fixtures";

import { MembersPageContent } from "./members-page-content";

vi.mock("@/app/(workspace)/members/actions", () => ({
  createMemberAction: vi.fn(),
  updateMemberAction: vi.fn(),
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

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MembersPageContent", () => {
  it("renders the page heading", () => {
    render(<MembersPageContent data={createEmptyMembersData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Members" }),
    ).toBeTruthy();
  });

  it("renders the Add Member control", () => {
    render(<MembersPageContent data={createEmptyMembersData()} />);

    expect(screen.getByRole("button", { name: "Add Member" })).toBeTruthy();
  });

  it("renders Edit controls for populated members", () => {
    render(<MembersPageContent data={createPopulatedMembersData()} />);

    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <MembersPageContent data={createEmptyMembersData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<MembersPageContent data={createEmptyMembersData()} />);

    expect(screen.getAllByText("No members yet.").length).toBeGreaterThan(0);
  });

  it("renders live member props", () => {
    render(<MembersPageContent data={createPopulatedMembersData()} />);

    expect(screen.getByText("Jordan Lee")).toBeTruthy();
    expect(screen.getByText(/jordan\.lee@example\.org/)).toBeTruthy();
    expect(
      screen.getByText("Total Members").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Active Members").closest("article")?.textContent,
    ).toContain("1");
  });

  it("renders honest zero counts when members data is empty", () => {
    render(<MembersPageContent data={createEmptyMembersData()} />);

    expect(
      screen.getByText("Total Members").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Active Members").closest("article")?.textContent,
    ).toContain("0");
  });

  it("does not fabricate unsupported metrics", () => {
    render(<MembersPageContent data={createPopulatedMembersData()} />);

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%\s*retention/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<MembersPageContent data={createEmptyMembersData()} />);

    expect(screen.getByRole("link", { name: /Giving/i }).getAttribute("href")).toBe(
      "/giving",
    );
    expect(screen.getByRole("link", { name: /Funds/i }).getAttribute("href")).toBe(
      "/funds",
    );
    expect(
      screen.getByRole("link", { name: /Reports/i }).getAttribute("href"),
    ).toBe("/reports");
  });
});
