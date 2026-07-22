import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(() => ({ client: "browser" })),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createBrowserSupabaseClient } from "./client";

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
  createBrowserClientMock.mockClear();
});

describe("createBrowserSupabaseClient", () => {
  it("creates an SSR browser client with the public URL and anon key", () => {
    expect(createBrowserSupabaseClient()).toEqual({ client: "browser" });
    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
    );
  });

  it("does not reference the service-role key", () => {
    createBrowserSupabaseClient();

    expect(createBrowserClientMock.mock.calls[0]).not.toContain(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
