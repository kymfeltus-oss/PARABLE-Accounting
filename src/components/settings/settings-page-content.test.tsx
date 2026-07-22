import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptySettingsData,
  createPopulatedSettingsData,
} from "@/lib/data/test/settings-data-fixtures";

import { SettingsPageContent } from "./settings-page-content";

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

afterEach(() => {
  cleanup();
});

describe("SettingsPageContent", () => {
  it("renders the page heading", () => {
    render(<SettingsPageContent data={createEmptySettingsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <SettingsPageContent data={createEmptySettingsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders live organization profile data", () => {
    render(<SettingsPageContent data={createPopulatedSettingsData()} />);

    expect(screen.getByText("Parable Community Church")).toBeTruthy();
    expect(screen.getByText("parable-community-church")).toBeTruthy();
    expect(
      screen.getByText("Organization Status").closest("article")?.textContent,
    ).toContain("active");
  });

  it("renders live membership access data", () => {
    render(<SettingsPageContent data={createPopulatedSettingsData()} />);

    expect(
      screen.getByText("Total Memberships").closest("article")?.textContent,
    ).toContain("2");
    expect(screen.getByRole("table").textContent).toContain(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("renders honest empty membership state", () => {
    render(<SettingsPageContent data={createEmptySettingsData()} />);

    expect(
      screen.getAllByText("No organization memberships yet.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Total Memberships").closest("article")?.textContent,
    ).toContain("0");
  });

  it("states persisted preferences are not yet implemented", () => {
    render(<SettingsPageContent data={createPopulatedSettingsData()} />);

    expect(
      screen.getByText(/Configurable application preferences are not yet persisted in the current schema/i),
    ).toBeTruthy();
    expect(screen.getByText(/Application preferences — not persisted/i)).toBeTruthy();
  });

  it("does not render fake editable controls or dead save actions", () => {
    const { container } = render(
      <SettingsPageContent data={createPopulatedSettingsData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(
      /save changes|update organization|invite member|change role|remove member|toggle|switch/i,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
  });

  it("does not fabricate membership roles or statuses", () => {
    const { container } = render(
      <SettingsPageContent data={createPopulatedSettingsData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).toContain(
      "Role and membership status fields are not present in the current schema.",
    );
    expect(text).not.toMatch(/\badmin\b|\beditor\b|\bviewer\b|active members/i);
  });

  it("renders related workspace navigation links", () => {
    render(<SettingsPageContent data={createEmptySettingsData()} />);

    expect(screen.getByRole("link", { name: /Dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /Audit Vault/i })).toHaveAttribute(
      "href",
      "/audit-vault",
    );
  });
});
