import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("auth redirect matrix", () => {
  it("redirects unauthenticated workspace access to /login", () => {
    const workspaceLayout = readSource("src/app/(workspace)/layout.tsx");

    expect(workspaceLayout).toContain('redirect("/login")');
    expect(workspaceLayout).toContain("getAuthenticatedUser");
  });

  it("redirects authenticated users away from /login to /dashboard", () => {
    const loginPage = readSource("src/app/login/page.tsx");

    expect(loginPage).toContain('redirect("/dashboard")');
    expect(loginPage).toContain("getAuthenticatedUser");
  });

  it("redirects authenticated users away from /create-account to /dashboard", () => {
    const createAccountPage = readSource("src/app/create-account/page.tsx");

    expect(createAccountPage).toContain('redirect("/dashboard")');
    expect(createAccountPage).toContain("getAuthenticatedUser");
  });

  it("keeps root redirecting to /dashboard without duplicate auth checks", () => {
    const homePage = readSource("src/app/page.tsx");

    expect(homePage).toContain('redirect("/dashboard")');
    expect(homePage).not.toContain("getAuthenticatedUser");
  });

  it("avoids redirect loops between public auth pages and workspace gate", () => {
    const workspaceLayout = readSource("src/app/(workspace)/layout.tsx");
    const loginPage = readSource("src/app/login/page.tsx");
    const createAccountPage = readSource("src/app/create-account/page.tsx");

    expect(workspaceLayout).toContain('redirect("/login")');
    expect(loginPage).toContain('redirect("/dashboard")');
    expect(createAccountPage).toContain('redirect("/dashboard")');
    expect(loginPage).not.toContain('redirect("/login")');
    expect(createAccountPage).not.toContain('redirect("/login")');
    expect(workspaceLayout).not.toContain('redirect("/dashboard")');
  });
});
