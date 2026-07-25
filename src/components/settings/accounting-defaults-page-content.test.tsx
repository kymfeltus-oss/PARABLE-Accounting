import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPopulatedSettingsData } from "@/lib/data/test/settings-data-fixtures";

import { AccountingDefaultsPageContent } from "./accounting-defaults-page-content";

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

vi.mock("@/components/settings/organization-settings-form", () => ({
  OrganizationSettingsForm: () => <div>Organization settings form</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("AccountingDefaultsPageContent", () => {
  it("renders the form for owners", () => {
    render(
      <AccountingDefaultsPageContent data={createPopulatedSettingsData("owner")} />,
    );

    expect(
      screen.getByRole("heading", { name: "Accounting Defaults" }),
    ).toBeTruthy();
    expect(screen.getByText("Organization settings form")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("blocks staff from editing", () => {
    render(
      <AccountingDefaultsPageContent
        data={createPopulatedSettingsData("staff")}
      />,
    );

    expect(screen.queryByText("Organization settings form")).toBeNull();
    expect(
      screen.getByText(/Only owners and accountants can edit accounting defaults/i),
    ).toBeTruthy();
  });
});
