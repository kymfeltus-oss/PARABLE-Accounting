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

import NoMembershipPage from "./page";

describe("No membership page route", () => {
  it("redirects unauthenticated users to /login", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(NoMembershipPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects users with one membership to /dashboard", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextMock.mockResolvedValue({
      status: "resolved",
      organizationId: "22222222-2222-4222-8222-222222222222",
    });

    await expect(NoMembershipPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects users with multiple memberships to /select-organization", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextMock.mockResolvedValue({
      status: "multiple",
      organizations: [],
    });

    await expect(NoMembershipPage()).rejects.toThrow("NEXT_REDIRECT:/select-organization");
  });

  it("renders the no-membership message for authenticated users with zero memberships", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    resolveOrganizationContextMock.mockResolvedValue({ status: "none" });

    const page = await NoMembershipPage();

    expect(page.props.children.props.description).toContain(
      "Your account is signed in, but it is not currently connected to a Parable Accounting organization.",
    );
    expect(page.props.children.props.footer.type.name).toBe("SignOutButton");
  });
});
