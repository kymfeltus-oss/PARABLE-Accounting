import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyGivingData,
  createPopulatedGivingData,
} from "@/lib/data/test/giving-data-fixtures";

import { GivingPageContent } from "./giving-page-content";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/app/(workspace)/giving/actions", () => ({
  createGivingTransactionAction: vi.fn(),
}));

const emptyFormProps = {
  memberOptions: [],
  fundOptions: [],
  debitAccountOptions: [],
  revenueAccountOptions: [],
};

afterEach(() => {
  cleanup();
});

describe("GivingPageContent", () => {
  it("renders the page heading", () => {
    render(<GivingPageContent data={createEmptyGivingData()} {...emptyFormProps} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Giving" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <GivingPageContent data={createEmptyGivingData()} {...emptyFormProps} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<GivingPageContent data={createEmptyGivingData()} {...emptyFormProps} />);

    expect(
      screen.getAllByText("No giving transactions yet.").length,
    ).toBeGreaterThan(0);
  });

  it("renders live KPI values from props", () => {
    render(<GivingPageContent data={createPopulatedGivingData()} {...emptyFormProps} />);

    expect(
      screen.getByText("Giving This Month").closest("article")?.textContent,
    ).toContain("$350.00");
    expect(screen.getByText("$175.00")).toBeTruthy();
    expect(
      screen.getByText("Active Givers").closest("article")?.textContent,
    ).toContain("2");
    expect(screen.getByText(/\$250\.00 · check · CHK-1001/)).toBeTruthy();
    expect(screen.getByText("General Fund")).toBeTruthy();
  });

  it("links recent giving transactions to their detail pages", () => {
    render(<GivingPageContent data={createPopulatedGivingData()} {...emptyFormProps} />);

    expect(screen.getByText("Posted to ledger")).toBeTruthy();
    expect(screen.getByText("Not posted to ledger")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Post to ledger" }),
    ).toHaveAttribute("href", "/giving/gift-2");
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/giving/gift-1",
    );
  });

  it("renders honest zero KPI values when giving data is empty", () => {
    render(<GivingPageContent data={createEmptyGivingData()} {...emptyFormProps} />);

    expect(
      screen.getByText("Giving This Month").closest("article")?.textContent,
    ).toContain("$0.00");
    expect(
      screen.getByText("Active Givers").closest("article")?.textContent,
    ).toContain("0");
  });

  it("does not fabricate unsupported insight metrics", () => {
    render(<GivingPageContent data={createPopulatedGivingData()} {...emptyFormProps} />);

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%\s*recurring/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<GivingPageContent data={createEmptyGivingData()} {...emptyFormProps} />);

    expect(screen.getByRole("link", { name: /Members/i }).getAttribute("href")).toBe(
      "/members",
    );
    expect(screen.getByRole("link", { name: /Funds/i }).getAttribute("href")).toBe(
      "/funds",
    );
    expect(
      screen.getByRole("link", { name: /Reports/i }).getAttribute("href"),
    ).toBe("/reports");
  });
});
