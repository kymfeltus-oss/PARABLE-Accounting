import { readFileSync } from "node:fs";
import path from "node:path";

import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <section aria-label="Mock app shell" data-testid="mock-app-shell">
      {children}
    </section>
  ),
}));

import WorkspaceLayout from "./layout";

const WORKSPACE_LAYOUT_PATH = path.join(process.cwd(), "src/app/(workspace)/layout.tsx");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceLayout auth gate", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "treasurer@example.org",
    });
    resolveOrganizationContextMock.mockResolvedValue({
      status: "resolved",
      organizationId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("calls getAuthenticatedUser()", async () => {
    await WorkspaceLayout({ children: <p>Workspace child content</p> });

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("redirects unauthenticated users to /login", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(
      WorkspaceLayout({ children: <p>Workspace child content</p> }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users with zero memberships to /no-membership", async () => {
    resolveOrganizationContextMock.mockResolvedValue({ status: "none" });

    await expect(
      WorkspaceLayout({ children: <p>Workspace child content</p> }),
    ).rejects.toThrow("NEXT_REDIRECT:/no-membership");

    expect(resolveOrganizationContextMock).toHaveBeenCalledWith("user-1");
  });

  it("redirects authenticated users with multiple memberships to /select-organization", async () => {
    resolveOrganizationContextMock.mockResolvedValue({
      status: "multiple",
      organizations: [
        {
          organizationId: "22222222-2222-4222-8222-222222222222",
          name: "Alpha Ministry",
        },
        {
          organizationId: "33333333-3333-4333-8333-333333333333",
          name: "Zion Fellowship",
        },
      ],
    });

    await expect(
      WorkspaceLayout({ children: <p>Workspace child content</p> }),
    ).rejects.toThrow("NEXT_REDIRECT:/select-organization");
  });

  it("renders the mocked AppShell with child content for authenticated users with one membership", async () => {
    const layout = await WorkspaceLayout({
      children: <p>Workspace child content</p>,
    });

    render(layout);

    const shell = screen.getByTestId("mock-app-shell");

    expect(shell).toBeTruthy();
    expect(within(shell).getByText("Workspace child content")).toBeTruthy();
  });

  it("source safety: resolves organization context without admin client access in layout", () => {
    const contents = readFileSync(WORKSPACE_LAYOUT_PATH, "utf8");

    expect(contents).toContain("getAuthenticatedUser");
    expect(contents).toContain("resolveOrganizationContext");
    expect(contents).not.toMatch(/PARABLE_ORGANIZATION_ID|getConfiguredOrganizationId/);
    expect(contents).not.toContain("@/lib/supabase/admin");
    expect(contents).not.toMatch(/organization_memberships/);
    expect(contents).not.toContain("createAdminSupabaseClient");
  });
});
