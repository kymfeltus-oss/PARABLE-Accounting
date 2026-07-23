import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSearchParams,
  JournalRegisterSection,
} from "./journal-register-section";

const rows = [
  {
    id: "journal-id-123",
    entryNumber: "JE-2026-0042",
    entryDate: "2026-07-23",
    description: "Recorded community outreach expense",
    source: "expense" as const,
    sourceReference: "EXP-1042",
    periodName: "July 2026",
    status: "posted" as const,
    totalDebit: 1250.5,
    totalCredit: 1250.5,
  },
];

const filters = {
  search: "",
  status: "all" as const,
  source: "all" as const,
};

const replaceMock = vi.fn();
const pushMock = vi.fn();
const pathname = "/accounting/journals";
let currentSearchParams = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(currentSearchParams),
}));

afterEach(() => {
  cleanup();
  replaceMock.mockReset();
  pushMock.mockReset();
  currentSearchParams = "";
});

describe("JournalRegisterSection", () => {
  it("renders journal rows through JournalRegisterTable", () => {
    render(
      <JournalRegisterSection
        filters={filters}
        page={1}
        pageSize={25}
        rows={rows}
        totalCount={1}
      />,
    );

    expect(screen.getByText("JE-2026-0042")).toBeVisible();
  });

  it("renders the View control for journal entries", () => {
    render(
      <JournalRegisterSection
        filters={filters}
        page={1}
        pageSize={25}
        rows={rows}
        totalCount={1}
      />,
    );

    expect(screen.getByRole("button", { name: "View" })).toBeVisible();
  });

  it("navigates to the exact journal id route when View is clicked", async () => {
    currentSearchParams = "search=July&status=posted";

    render(
      <JournalRegisterSection
        filters={{ ...filters, search: "July", status: "posted" }}
        page={2}
        pageSize={25}
        rows={rows}
        totalCount={1}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "View" }));

    expect(pushMock).toHaveBeenCalledWith("/accounting/journals/journal-id-123");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("updates URL search parameters when filters change", async () => {
    currentSearchParams = "search=July&page=2";

    render(
      <JournalRegisterSection
        filters={{ ...filters, search: "July" }}
        page={2}
        pageSize={25}
        rows={rows}
        totalCount={1}
      />,
    );

    await userEvent.setup().selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "posted",
    );

    expect(replaceMock).toHaveBeenCalledWith(
      `${pathname}?search=July&status=posted`,
    );
  });

  it("updates pagination through URL search parameters", async () => {
    currentSearchParams = "";

    render(
      <JournalRegisterSection
        filters={filters}
        page={1}
        pageSize={1}
        rows={rows}
        totalCount={3}
      />,
    );

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Next" }),
    );

    expect(replaceMock).toHaveBeenCalledWith(`${pathname}?page=2`);
  });
});

describe("buildSearchParams", () => {
  it("preserves unrelated search parameters", () => {
    const params = buildSearchParams(new URLSearchParams("foo=bar&page=2"), {
      status: "posted",
    });

    expect(params.get("foo")).toBe("bar");
    expect(params.get("status")).toBe("posted");
    expect(params.get("page")).toBeNull();
  });
});
