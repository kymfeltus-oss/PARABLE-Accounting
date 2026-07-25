import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { JournalRegisterResult } from "@/lib/data/journal-register-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getJournalRegisterMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getJournalRegisterMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/journal-register-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/data/journal-register-repository")
  >("@/lib/data/journal-register-repository");

  return {
    ...actual,
    getJournalRegister: getJournalRegisterMock,
  };
});

vi.mock("@/components/accounting/journal-register-section", () => ({
  JournalRegisterSection: ({
    rows,
    filters,
    page,
    pageSize,
    totalCount,
  }: {
    rows: unknown[];
    filters: unknown;
    page: number;
    pageSize: number;
    totalCount: number;
  }) => (
    <section aria-label="Journal register section">
      <p data-testid="row-count">{rows.length}</p>
      <pre data-testid="filters">{JSON.stringify(filters)}</pre>
      <pre data-testid="pagination">
        {JSON.stringify({ page, pageSize, totalCount })}
      </pre>
    </section>
  ),
}));

import JournalRegisterPage from "./page";

function getRegisterSection(page: Awaited<ReturnType<typeof JournalRegisterPage>>) {
  const children = Array.isArray(page.props.children)
    ? page.props.children
    : [page.props.children];

  return children.find(
    (child) =>
      child &&
      typeof child === "object" &&
      "props" in child &&
      Array.isArray((child as { props?: { rows?: unknown } }).props?.rows),
  ) as React.ReactElement | undefined;
}

function createRegisterResult(
  overrides: Partial<JournalRegisterResult> = {},
): JournalRegisterResult {
  return {
    entries: [
      {
        id: "journal-id-123",
        entryNumber: "JE-2026-0042",
        entryDate: "2026-07-23",
        description: "Recorded community outreach expense",
        source: "expense",
        sourceReference: "EXP-1042",
        periodName: "July 2026",
        status: "posted",
        totalDebit: 1250.5,
        totalCredit: 1250.5,
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

describe("Journal register page wiring", () => {
  it("uses the current organization id server-side", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getJournalRegisterMock.mockResolvedValue(createRegisterResult());

    await JournalRegisterPage({
      searchParams: Promise.resolve({}),
    });

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getJournalRegisterMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        page: undefined,
        pageSize: undefined,
      }),
    );
  });

  it("parses safe search params and maps rows to the section", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getJournalRegisterMock.mockResolvedValue(createRegisterResult());

    const page = await JournalRegisterPage({
      searchParams: Promise.resolve({
        search: "July",
        status: "posted",
        source: "expense",
        page: "2",
        pageSize: "10",
      }),
    });
    const registerSection = getRegisterSection(page);

    expect(getJournalRegisterMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        search: "July",
        status: "posted",
        source: "expense",
        page: 2,
        pageSize: 10,
      }),
    );
    expect(registerSection?.props.rows).toHaveLength(1);
    expect(registerSection?.props.rows[0]?.entryNumber).toBe("JE-2026-0042");
    expect(registerSection?.props.filters).toEqual({
      search: "July",
      status: "posted",
      source: "expense",
    });
  });

  it("renders empty results without inventing journal detail links", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getJournalRegisterMock.mockResolvedValue(
      createRegisterResult({ entries: [], totalCount: 0 }),
    );

    const page = await JournalRegisterPage({
      searchParams: Promise.resolve({}),
    });
    const registerSection = getRegisterSection(page);

    expect(registerSection?.props.rows).toEqual([]);
    expect(registerSection?.props.totalCount).toBe(0);
  });

  it("does not accept organization id from client input", () => {
    const contents = readFileSync(
      path.join(
        process.cwd(),
        "src/app/(workspace)/accounting/journals/page.tsx",
      ),
      "utf8",
    );

    expect(contents).toContain("getCurrentOrganizationId()");
    expect(contents).not.toMatch(/organizationId:\s*string/);
  });

  it("includes a Create journal entry action to the new journal page", () => {
    const contents = readFileSync(
      path.join(
        process.cwd(),
        "src/app/(workspace)/accounting/journals/page.tsx",
      ),
      "utf8",
    );

    expect(contents).toContain('href="/accounting/journals/new"');
    expect(contents).toContain("Create journal entry");
  });
});
