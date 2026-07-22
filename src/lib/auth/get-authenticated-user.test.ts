import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServerSupabaseClientMock,
  getUserMock,
} = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { getAuthenticatedUser } from "./get-authenticated-user";

describe("getAuthenticatedUser", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
    getUserMock.mockReset();
  });

  it("returns the authenticated user when auth.getUser succeeds", async () => {
    const user = {
      id: "user-1",
      email: "treasurer@example.org",
    };

    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock.mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    });

    await expect(getAuthenticatedUser()).resolves.toEqual(user);
    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when no authenticated user is present", async () => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock.mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });

  it("returns null when auth.getUser reports an error", async () => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock.mockResolvedValue({
          data: { user: null },
          error: { message: "invalid session" },
        }),
      },
    });

    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });
});
