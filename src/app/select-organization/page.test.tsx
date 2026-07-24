import { describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedUserMock,
  redirectMock,
  resolveOrganizationContextForAuthenticatedUserMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  resolveOrganizationContextForAuthenticatedUserMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  resolveOrganizationContextForAuthenticatedUser:
    resolveOrganizationContextForAuthenticatedUserMock,
}));

vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

vi.mock("@/components/organization/select-organization-form", () => ({
  SelectOrganizationForm: ({
    organizations,
  }: {
    organizations: Array<{ organizationId: string; name: string }>;
  }) => (
    <div data-testid="select-organization-form">{organizations.length}</div>
  ),
}));

import SelectOrganizationPage from "./page";

const organizations = [
  {
    organizationId: "22222222-2222-4222-8222-222222222222",
    name: "Alpha Ministry",
  },
  {
    organizationId: "33333333-3333-4333-8333-333333333333",
    name: "Zion Fellowship",
  },
];

describe("Select organization page route", () => {
  it("redirects unauthenticated users to /login", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(SelectOrganizationPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects users with zero memberships to /no-membership", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextForAuthenticatedUserMock.mockResolvedValue({
      status: "none",
    });

    await expect(SelectOrganizationPage()).rejects.toThrow("NEXT_REDIRECT:/no-membership");
  });

  it("redirects users with one membership to /dashboard", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextForAuthenticatedUserMock.mockResolvedValue({
      status: "resolved",
      organizationId: organizations[0].organizationId,
    });

    await expect(SelectOrganizationPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders the selection form for multiple memberships", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextForAuthenticatedUserMock.mockResolvedValue({
      status: "multiple",
      organizations,
    });

    const page = await SelectOrganizationPage();
    const form = page.props.children.props.children;

    expect(form.type.name).toBe("SelectOrganizationForm");
    expect(form.props.organizations).toEqual(organizations);
    expect(page.props.children.props.footer.type.name).toBe("SignOutButton");
  });
});
