import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyAuditVaultData,
  createPopulatedAuditVaultData,
} from "@/lib/data/test/audit-vault-data-fixtures";

import { AuditVaultPageContent } from "./audit-vault-page-content";

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

describe("AuditVaultPageContent", () => {
  it("renders the page heading", () => {
    render(<AuditVaultPageContent data={createEmptyAuditVaultData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Audit Vault" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <AuditVaultPageContent data={createEmptyAuditVaultData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<AuditVaultPageContent data={createEmptyAuditVaultData()} />);

    expect(screen.getAllByText("No audit records yet.").length).toBeGreaterThan(0);
  });

  it("renders live audit event and document props", () => {
    render(<AuditVaultPageContent data={createPopulatedAuditVaultData()} />);

    expect(screen.getByText("Journal entry posted to general ledger.")).toBeTruthy();
    expect(screen.getByText("July Board Financial Summary")).toBeTruthy();
    expect(
      screen.getByText("Total Audit Events").closest("article")?.textContent,
    ).toContain("3");
    expect(
      screen.getByText("Documents Added This Month").closest("article")?.textContent,
    ).toContain("2");
  });

  it("renders honest zero counts when audit vault data is empty", () => {
    render(<AuditVaultPageContent data={createEmptyAuditVaultData()} />);

    expect(
      screen.getByText("Total Audit Documents").closest("article")?.textContent,
    ).toContain("0");
  });

  it("filters audit events by stored event_type values", () => {
    render(<AuditVaultPageContent data={createPopulatedAuditVaultData()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "compliance item completed" }),
    );

    const eventsSection = screen.getByRole("heading", {
      name: "Recent Audit Events",
    }).parentElement?.parentElement;
    const eventsTable = eventsSection?.querySelector("table");

    expect(eventsTable?.textContent).toContain("compliance item");
    expect(eventsTable?.textContent).not.toContain("journal entry posted");
  });

  it("filters audit documents by schema-backed document_type", () => {
    render(<AuditVaultPageContent data={createPopulatedAuditVaultData()} />);

    fireEvent.click(screen.getByRole("button", { name: "Banking" }));

    expect(screen.getByText("Bank Reconciliation Workpaper")).toBeTruthy();
    expect(screen.queryByText("July Board Financial Summary")).toBeNull();
  });

  it("filters audit events by search text", () => {
    render(<AuditVaultPageContent data={createPopulatedAuditVaultData()} />);

    fireEvent.change(screen.getByPlaceholderText(/Search by event type/i), {
      target: { value: "integration" },
    });

    expect(
      screen.getByText("Exception marked resolved by integration sync."),
    ).toBeTruthy();
    expect(
      screen.queryByText("Journal entry posted to general ledger."),
    ).toBeNull();
  });

  it("states cryptographic verification and chain-of-custody are not implemented", () => {
    render(<AuditVaultPageContent data={createPopulatedAuditVaultData()} />);

    expect(
      screen.getByText(/Audit Vault reflects recorded audit events and document metadata/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Cryptographic verification, legal chain-of-custody certification/i),
    ).toBeTruthy();
  });

  it("does not render fake download actions or tamper-proof claims", () => {
    const { container } = render(
      <AuditVaultPageContent data={createPopulatedAuditVaultData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/download|verify integrity|notarize|tamper-proof|verified checksum/i);
  });

  it("does not expose sensitive internal values", () => {
    const { container } = render(
      <AuditVaultPageContent data={createPopulatedAuditVaultData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|signed url|storage path/i);
  });

  it("renders related workspace navigation links", () => {
    render(<AuditVaultPageContent data={createEmptyAuditVaultData()} />);

    expect(screen.getByRole("link", { name: /Accounting/i })).toHaveAttribute(
      "href",
      "/accounting",
    );
    expect(screen.getByRole("link", { name: /Compliance/i })).toHaveAttribute(
      "href",
      "/compliance",
    );
  });
});
