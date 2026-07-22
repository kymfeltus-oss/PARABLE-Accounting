import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  createServerClientMock,
  getUserMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(async () => ({ data: { user: null }, error: null })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { updateSession } from "./update-session";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  };

  createServerClientMock.mockImplementation((_url, _anonKey, options) => {
    const cookieHandlers = options.cookies;

    return {
      auth: {
        getUser: getUserMock,
      },
      __cookieHandlers: cookieHandlers,
    };
  });
});

afterEach(() => {
  process.env = originalEnv;
  createServerClientMock.mockReset();
  getUserMock.mockClear();
});

describe("updateSession", () => {
  it("uses the SSR server client and validates the session with auth.getUser", async () => {
    const request = new NextRequest("https://example.com/dashboard");

    const response = await updateSession(request);

    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("propagates refreshed cookies onto the response", async () => {
    createServerClientMock.mockImplementation((_url, _anonKey, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll([
            {
              name: "sb-access-token",
              value: "refreshed-token",
              options: { path: "/" },
            },
          ]);

          return { data: { user: null }, error: null };
        },
      },
    }));

    const request = new NextRequest("https://example.com/dashboard");
    const response = await updateSession(request);

    expect(response.cookies.get("sb-access-token")?.value).toBe(
      "refreshed-token",
    );
  });

  it("does not redirect unauthenticated users", async () => {
    const request = new NextRequest("https://example.com/dashboard");
    const response = await updateSession(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not read PARABLE_ORGANIZATION_ID", async () => {
    process.env.PARABLE_ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

    const request = new NextRequest("https://example.com/dashboard");
    await updateSession(request);

    expect(createServerClientMock).toHaveBeenCalled();
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });
});
