import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptySettingsData,
  createPopulatedSettingsData,
  createSettingsDataWithCurrentUserRole,
} from "@/lib/data/test/settings-data-fixtures";
import type { OrganizationMembershipRole } from "@/lib/data/settings-repository";

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

vi.mock("@/components/settings/organization-profile-form", () => ({
  OrganizationProfileForm: () => <div>Organization profile form</div>,
}));

vi.mock("@/components/settings/organization-settings-form", () => ({
  OrganizationSettingsForm: () => <div>Organization settings form</div>,
}));

vi.mock("@/components/settings/create-invite-form", () => ({
  CreateInviteForm: () => <div>Create invite form</div>,
}));

vi.mock("@/components/settings/organization-invites-table", () => ({
  OrganizationInvitesTable: () => <div>Organization invites table</div>,
}));

vi.mock("@/components/settings/organization-memberships-table", () => ({
  OrganizationMembershipsTable: ({
    canManageRoles,
  }: {
    canManageRoles?: boolean;
  }) => (
    <div>
      Organization memberships table
      {canManageRoles ? " (can manage roles)" : ""}
    </div>
  ),
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

const roleDisplayCases: Array<{
  role: OrganizationMembershipRole;
  label: string;
}> = [
  { role: "owner", label: "Owner" },
  { role: "accountant", label: "Accountant" },
  { role: "staff", label: "Staff" },
  { role: "viewer", label: "Viewer" },
];

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
    render(
      <SettingsPageContent
        data={createSettingsDataWithCurrentUserRole("staff")}
      />,
    );

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
    expect(
      screen.getByText("Organization memberships table (can manage roles)"),
    ).toBeTruthy();
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

  it.each(roleDisplayCases)(
    "displays the authenticated user's $role role as $label",
    ({ role, label }) => {
      render(
        <SettingsPageContent
          data={createSettingsDataWithCurrentUserRole(role)}
        />,
      );

      const roleTerm = screen.getByText("Your role");
      expect(roleTerm.closest("dl")?.textContent).toContain(label);
    },
  );

  it("does not display the outdated schema message about role fields", () => {
    const { container } = render(
      <SettingsPageContent data={createPopulatedSettingsData()} />,
    );

    expect(container.textContent).not.toContain(
      "Role and membership status fields are not present in the current schema.",
    );
    expect(container.textContent).not.toMatch(/membership status/i);
  });

  it("does not render unfinished configuration availability placeholders", () => {
    const { container } = render(
      <SettingsPageContent data={createPopulatedSettingsData()} />,
    );

    expect(container.textContent).not.toContain("Configuration Availability");
    expect(container.textContent).not.toMatch(/not persisted/i);
  });

  it("renders owner management forms", () => {
    render(<SettingsPageContent data={createPopulatedSettingsData("owner")} />);

    expect(screen.getByText("Organization profile form")).toBeTruthy();
    expect(screen.getByText("Organization settings form")).toBeTruthy();
    expect(screen.getByText("Create invite form")).toBeTruthy();
    expect(screen.getByText("Organization invites table")).toBeTruthy();
  });

  it("renders accounting defaults for accountants without owner invite controls", () => {
    render(
      <SettingsPageContent data={createPopulatedSettingsData("accountant")} />,
    );

    expect(screen.getByText("Organization settings form")).toBeTruthy();
    expect(screen.queryByText("Organization profile form")).toBeNull();
    expect(screen.queryByText("Create invite form")).toBeNull();
  });

  it("does not render editable owner controls for staff", () => {
    render(<SettingsPageContent data={createPopulatedSettingsData("staff")} />);

    expect(screen.getByRole("heading", { name: "Accounting Defaults" })).toBeTruthy();
    expect(
      screen.getByText(/Only owners and accountants can edit accounting defaults/i),
    ).toBeTruthy();
    expect(screen.queryByText("Organization profile form")).toBeNull();
    expect(screen.queryByText("Organization settings form")).toBeNull();
    expect(screen.queryByText("Create invite form")).toBeNull();
  });

  it("puts Accounting Defaults near the top with a jump link", () => {
    render(<SettingsPageContent data={createEmptySettingsData()} />);

    expect(
      screen.getByRole("link", { name: "Accounting Defaults" }),
    ).toHaveAttribute("href", "#accounting-defaults");
    expect(
      screen.getByRole("heading", { name: "Accounting Defaults" }),
    ).toBeTruthy();
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
