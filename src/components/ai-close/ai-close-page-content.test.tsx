import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyAiCloseData,
  createPopulatedAiCloseData,
} from "@/lib/data/test/ai-close-data-fixtures";

import { AiClosePageContent } from "./ai-close-page-content";

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

afterEach(() => {
  cleanup();
});

describe("AiClosePageContent", () => {
  it("renders the page heading", () => {
    render(<AiClosePageContent data={createEmptyAiCloseData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "AI Close" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <AiClosePageContent data={createEmptyAiCloseData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<AiClosePageContent data={createEmptyAiCloseData()} />);

    expect(
      screen.getAllByText("No close sessions or tasks yet.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("No close sessions yet.")).toBeTruthy();
    expect(screen.getByText("No open close tasks.")).toBeTruthy();
    expect(
      screen.getByText(/AI confidence scores.*are not available yet/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open accounting" }),
    ).toHaveAttribute("href", "/accounting");
  });

  it("renders live close session and task props", () => {
    render(<AiClosePageContent data={createPopulatedAiCloseData()} />);

    expect(screen.getByText("July 2026")).toBeTruthy();
    expect(screen.getByText("Review posted journals")).toBeTruthy();
    expect(
      screen.getByText("In Progress Sessions").closest("article")?.textContent,
    ).toContain("1");
  });

  it("filters close sessions by schema-backed status", () => {
    render(<AiClosePageContent data={createPopulatedAiCloseData()} />);

    expect(screen.getByRole("table").textContent).toContain("July 2026");

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));

    const sessionTable = screen.getByRole("table");
    expect(sessionTable.textContent).toContain("June 2026");
    expect(sessionTable.textContent).not.toContain("July 2026");
  });

  it("filters open tasks by search text", () => {
    render(<AiClosePageContent data={createPopulatedAiCloseData()} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Reconcile" },
    });

    expect(screen.getByText("Reconcile operating account")).toBeTruthy();
    expect(screen.queryByText("Review posted journals")).toBeNull();
  });

  it("states automation metrics are unavailable", () => {
    render(<AiClosePageContent data={createPopulatedAiCloseData()} />);

    expect(
      screen.getByText(/AI confidence scores.*are not available yet/i),
    ).toBeTruthy();
  });

  it("does not fabricate readiness scores or force-run controls", () => {
    const { container } = render(
      <AiClosePageContent data={createPopulatedAiCloseData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/readiness percentage|force-run/i);
    expect(text).not.toMatch(/\b\d{1,3}%\b/);
  });

  it("renders related workspace navigation links", () => {
    render(<AiClosePageContent data={createEmptyAiCloseData()} />);

    expect(
      screen.getByRole("link", { name: /Accounting.*Review ledger/i }),
    ).toHaveAttribute("href", "/accounting");
    expect(
      screen.getByRole("link", { name: /Reports.*report-ready/i }),
    ).toHaveAttribute("href", "/reports");
  });
});
