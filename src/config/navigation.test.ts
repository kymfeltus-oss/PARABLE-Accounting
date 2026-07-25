import { describe, expect, it } from "vitest";

import {
  getNavItemByPathname,
  isNavItemActive,
  navGroups,
  navItems,
  type NavGroupId,
  type NavItemId,
} from "./navigation";

const requiredRoutes = [
  "/dashboard",
  "/giving",
  "/members",
  "/banking",
  "/transactions",
  "/expenses",
  "/bills",
  "/vendors",
  "/funds",
  "/budgets",
  "/accounting",
  "/reports",
  "/ai-close",
  "/compliance",
  "/exceptions",
  "/audit-vault",
  "/settings",
] as const;

const approvedGroupOrder: NavGroupId[] = [
  "overview",
  "giving-members",
  "banking-spending",
  "vendors-planning",
  "accounting",
  "compliance",
  "system",
];

const approvedItemOrderByGroup: Record<NavGroupId, NavItemId[]> = {
  overview: ["dashboard"],
  "giving-members": ["giving", "members"],
  "banking-spending": ["banking", "transactions", "expenses", "bills"],
  "vendors-planning": ["vendors", "funds", "budgets"],
  accounting: ["accounting", "reports", "ai-close"],
  compliance: ["compliance", "exceptions", "audit-vault"],
  system: ["settings"],
};

describe("navigation configuration", () => {
  it("contains exactly 17 navigation items", () => {
    expect(navItems).toHaveLength(17);
  });

  it("includes every required route", () => {
    const hrefs = navItems.map((item) => item.href);

    for (const route of requiredRoutes) {
      expect(hrefs).toContain(route);
    }
  });

  it("has no duplicate IDs", () => {
    const ids = navItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate hrefs", () => {
    const hrefs = navItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("requires nonempty label, title, and description on every item", () => {
    for (const item of navItems) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("assigns every item to a valid group", () => {
    const groupIds = new Set(navGroups.map((group) => group.id));

    for (const item of navItems) {
      expect(groupIds.has(item.group)).toBe(true);
    }
  });

  it("matches the approved group order", () => {
    expect(navGroups.map((group) => group.id)).toEqual(approvedGroupOrder);
  });

  it("matches the approved item order within each group", () => {
    for (const group of navGroups) {
      expect(group.items.map((item) => item.id)).toEqual(
        approvedItemOrderByGroup[group.id],
      );
    }
  });

  it("returns the correct item for exact-path lookup", () => {
    const item = getNavItemByPathname("/transactions");

    expect(item).toBeDefined();
    expect(item?.id).toBe("transactions");
    expect(item?.href).toBe("/transactions");
  });

  it("returns undefined for unknown paths", () => {
    expect(getNavItemByPathname("/unknown")).toBeUndefined();
    expect(getNavItemByPathname("/")).toBeUndefined();
  });

  it("returns true for exact-path active matching", () => {
    const item = getNavItemByPathname("/settings");

    expect(item).toBeDefined();
    expect(isNavItemActive("/settings", item!)).toBe(true);
  });

  it("returns false for nonmatching and nested paths", () => {
    const item = getNavItemByPathname("/settings");

    expect(item).toBeDefined();
    expect(isNavItemActive("/settings/accounting-defaults", item!)).toBe(true);
    expect(isNavItemActive("/dashboard", item!)).toBe(false);
  });

  it("defines an icon for every item", () => {
    for (const item of navItems) {
      expect(item.icon).toBeDefined();
      expect(item.icon).not.toBeNull();
    }
  });

  it("derives the flat collection from grouped configuration", () => {
    expect(navItems).toEqual(navGroups.flatMap((group) => group.items));
  });
});
