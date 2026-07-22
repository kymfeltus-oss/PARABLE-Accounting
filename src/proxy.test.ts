import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { updateSessionMock } = vi.hoisted(() => ({
  updateSessionMock: vi.fn(async () => new Response(null, { status: 200 })),
}));

vi.mock("@/lib/supabase/update-session", () => ({
  updateSession: updateSessionMock,
}));

import { config, proxy } from "@/proxy";

describe("proxy", () => {
  it("delegates to updateSession for session refresh", async () => {
    const request = new NextRequest("https://example.com/dashboard");

    await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
  });

  it("excludes static assets and internal Next routes from the matcher", () => {
    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });
});
