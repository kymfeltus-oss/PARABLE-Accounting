import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, cookiesMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(() => ({ client: "server" })),
  cookiesMock: vi.fn(async () => ({
    getAll: () => [{ name: "sb-access-token", value: "token-value" }],
    set: vi.fn(),
  })),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { createServerSupabaseClient } from "./server";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  };
});

afterEach(() => {
  process.env = originalEnv;
  createServerClientMock.mockClear();
  cookiesMock.mockClear();
});

describe("createServerSupabaseClient", () => {
  it("creates a cookie-aware SSR server client with the public URL and anon key", async () => {
    await expect(createServerSupabaseClient()).resolves.toEqual({
      client: "server",
    });
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
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
  });

  it("reads cookies through getAll and supports setAll updates", async () => {
    await createServerSupabaseClient();

    const cookieHandlers = createServerClientMock.mock.calls[0]?.[2]?.cookies;
    expect(cookieHandlers?.getAll()).toEqual([
      { name: "sb-access-token", value: "token-value" },
    ]);

    expect(() =>
      cookieHandlers?.setAll([
        {
          name: "sb-access-token",
          value: "refreshed-token",
          options: { path: "/" },
        },
      ]),
    ).not.toThrow();
  });

  it("does not reference the service-role key", async () => {
    await createServerSupabaseClient();

    expect(createServerClientMock.mock.calls[0]).not.toContain(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
