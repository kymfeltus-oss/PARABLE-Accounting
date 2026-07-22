import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ client: "admin" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("./admin", () => {
  const { readFileSync: readAdminSource } = require("node:fs") as typeof import("node:fs");
  const adminPath = require("node:path") as typeof import("node:path");

  const strippedSource = readAdminSource(
    adminPath.join(process.cwd(), "src/lib/supabase/admin.ts"),
    "utf8",
  )
    .replace(/^import "server-only";\r?\n/m, "")
    .replace(
      /^import \{ createClient \} from "@supabase\/supabase-js";\r?\n/m,
      "",
    )
    .replace(/^type SupabaseAdminEnv = \{[\s\S]*?\};\r?\n/m, "")
    .replace(/: string/g, "")
    .replace(/: SupabaseAdminEnv/g, "")
    .replace(/export function /g, "function ");

  const module = {
    exports: {} as {
      createAdminSupabaseClient: () => unknown;
    },
  };

  const executableSource = [
    "const createClient = (...args) => __createClientMock(...args);",
    strippedSource,
    "module.exports = { createAdminSupabaseClient };",
  ].join("\n");

  new Function("module", "exports", "__createClientMock", executableSource)(
    module,
    module.exports,
    createClientMock,
  );

  return module.exports;
});

import { createAdminSupabaseClient } from "./admin";

const originalEnv = process.env;
const SECRET_SERVICE_ROLE_KEY = "super-secret-service-role-key-value";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;

function setAdminEnv(url?: string, serviceRoleKey?: string) {
  if (url === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }

  if (serviceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  }
}

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }

      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

beforeEach(() => {
  process.env = { ...originalEnv };
  createClientMock.mockClear();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("createAdminSupabaseClient", () => {
  it("creates a Supabase client with the public URL and service-role key", () => {
    setAdminEnv("https://project.supabase.co", "service-role-key");

    expect(createAdminSupabaseClient()).toEqual({ client: "admin" });
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  });

  it("throws a clear configuration error when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    setAdminEnv("https://project.supabase.co", undefined);

    expect(() => createAdminSupabaseClient()).toThrow(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws a clear configuration error when SUPABASE_SERVICE_ROLE_KEY is blank", () => {
    setAdminEnv("https://project.supabase.co", "   ");

    expect(() => createAdminSupabaseClient()).toThrow(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("never includes the service-role secret in thrown error messages", () => {
    setAdminEnv(undefined, SECRET_SERVICE_ROLE_KEY);

    let thrownMessage = "";

    try {
      createAdminSupabaseClient();
    } catch (error) {
      thrownMessage = error instanceof Error ? error.message : String(error);
    }

    expect(thrownMessage).toContain(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(thrownMessage).not.toContain(SECRET_SERVICE_ROLE_KEY);
  });

  it("source safety: service-role key is not referenced from browser or client code", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      if (TEST_FILE_PATTERN.test(filePath)) {
        continue;
      }

      if (filePath.endsWith(`${path.sep}admin.ts`)) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);

      if (contents.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        violations.push(`${relativePath} references SUPABASE_SERVICE_ROLE_KEY`);
      }

      if (/NEXT_PUBLIC_.*SERVICE_ROLE/.test(contents)) {
        violations.push(`${relativePath} exposes service role via NEXT_PUBLIC`);
      }

      if (
        contents.includes('"use client"') ||
        contents.includes("'use client'")
      ) {
        if (contents.includes("@/lib/supabase/admin")) {
          violations.push(`${relativePath} imports admin client in Client Component`);
        }
      }

      if (relativePath.endsWith(path.join("lib", "supabase", "client.ts"))) {
        if (contents.includes("SUPABASE_SERVICE_ROLE_KEY")) {
          violations.push(`${relativePath} references service-role key in browser client`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
