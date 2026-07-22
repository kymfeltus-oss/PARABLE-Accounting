import { describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedUserMock,
  redirectMock,
  resolveOrganizationContextMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  resolveOrganizationContextMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  resolveOrganizationContext: resolveOrganizationContextMock,
}));

vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
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
    resolveOrganizationContextMock.mockResolvedValue({ status: "none" });

    await expect(SelectOrganizationPage()).rejects.toThrow("NEXT_REDIRECT:/no-membership");
  });

  it("redirects users with one membership to /dashboard", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextMock.mockResolvedValue({
      status: "resolved",
      organizationId: organizations[0].organizationId,
    });

    await expect(SelectOrganizationPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders the selection-required state for multiple memberships", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextMock.mockResolvedValue({
      status: "multiple",
      organizations,
    });

    const page = await SelectOrganizationPage();
    const cardChildren = page.props.children.props.children;

    expect(cardChildren.props.children[0].props.children).toHaveLength(2);
    expect(cardChildren.props.children[1].props.children).toContain(
      "Organization switching is not available yet.",
    );
    expect(page.props.children.props.footer.type.name).toBe("SignOutButton");
  });
});
