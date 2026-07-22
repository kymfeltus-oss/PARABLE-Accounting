import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getSupabasePublicEnv } from "./env";

const ENV_SOURCE_PATH = path.join(import.meta.dirname, "env.ts");

const originalEnv = process.env;

function setSupabaseEnv(url?: string, anonKey?: string) {
  if (url === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }

  if (anonKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  }
}

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getSupabasePublicEnv", () => {
  it("returns valid Supabase public environment values", () => {
    setSupabaseEnv("https://project.supabase.co", "anon-key");

    expect(getSupabasePublicEnv()).toEqual({
      url: "https://project.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("trims leading and trailing whitespace", () => {
    setSupabaseEnv("  https://project.supabase.co  ", "  anon-key  ");

    expect(getSupabasePublicEnv()).toEqual({
      url: "https://project.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    setSupabaseEnv(undefined, "anon-key");

    expect(() => getSupabasePublicEnv()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is empty", () => {
    setSupabaseEnv("", "anon-key");

    expect(() => getSupabasePublicEnv()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is whitespace only", () => {
    setSupabaseEnv("   ", "anon-key");

    expect(() => getSupabasePublicEnv()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
    setSupabaseEnv("https://project.supabase.co", undefined);

    expect(() => getSupabasePublicEnv()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is empty", () => {
    setSupabaseEnv("https://project.supabase.co", "");

    expect(() => getSupabasePublicEnv()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is whitespace only", () => {
    setSupabaseEnv("https://project.supabase.co", "   ");

    expect(() => getSupabasePublicEnv()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("restores environment variables after each test", () => {
    expect(process.env).not.toBe(originalEnv);
  });

  it("source safety: reads NEXT_PUBLIC variables through static process.env references", () => {
    const contents = readFileSync(ENV_SOURCE_PATH, "utf8");

    expect(contents).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(contents).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(contents).not.toMatch(/process\.env\[[^\]]+\]/);
    expect(contents).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
