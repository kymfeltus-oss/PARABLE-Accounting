import type { ComponentType } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BankingPageContent } from "@/components/banking/banking-page-content";
import { BillsPageContent } from "@/components/bills/bills-page-content";
import { ExpensesPageContent } from "@/components/expenses/expenses-page-content";
import { FundsPageContent } from "@/components/funds/funds-page-content";
import { BudgetsPageContent } from "@/components/budgets/budgets-page-content";
import { AccountingPageContent } from "@/components/accounting/accounting-page-content";
import { ReportsPageContent } from "@/components/reports/reports-page-content";
import { AiClosePageContent } from "@/components/ai-close/ai-close-page-content";
import { CompliancePageContent } from "@/components/compliance/compliance-page-content";
import { ExceptionsPageContent } from "@/components/exceptions/exceptions-page-content";
import { AuditVaultPageContent } from "@/components/audit-vault/audit-vault-page-content";
import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { VendorsPageContent } from "@/components/vendors/vendors-page-content";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { GivingPageContent } from "@/components/giving/giving-page-content";
import { MembersPageContent } from "@/components/members/members-page-content";
import { TransactionsPageContent } from "@/components/transactions/transactions-page-content";
import { createEmptyDashboardData } from "@/lib/data/test/dashboard-data-fixtures";
import { createEmptyGivingData } from "@/lib/data/test/giving-data-fixtures";
import { createEmptyMembersData } from "@/lib/data/test/members-data-fixtures";
import { createEmptyBankingData } from "@/lib/data/test/banking-data-fixtures";
import { createEmptyBillsData } from "@/lib/data/test/bills-data-fixtures";
import { createEmptyExpensesData } from "@/lib/data/test/expenses-data-fixtures";
import { createEmptyVendorsData } from "@/lib/data/test/vendors-data-fixtures";
import { createEmptyFundsData } from "@/lib/data/test/funds-data-fixtures";
import { createEmptyBudgetsData } from "@/lib/data/test/budgets-data-fixtures";
import { createEmptyAccountingData } from "@/lib/data/test/accounting-data-fixtures";
import { createEmptyReportsData } from "@/lib/data/test/reports-data-fixtures";
import { createEmptyAiCloseData } from "@/lib/data/test/ai-close-data-fixtures";
import { createEmptyComplianceData } from "@/lib/data/test/compliance-data-fixtures";
import { createEmptyExceptionsData } from "@/lib/data/test/exceptions-data-fixtures";
import { createEmptyAuditVaultData } from "@/lib/data/test/audit-vault-data-fixtures";
import { createEmptySettingsData } from "@/lib/data/test/settings-data-fixtures";
import { createEmptyTransactionsData } from "@/lib/data/test/transactions-data-fixtures";

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

describe("production workspace preview regression", () => {
  it("Dashboard does not render Development Preview", () => {
    const { container } = render(
      <DashboardPageContent data={createEmptyDashboardData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Giving does not render Development Preview", () => {
    const { container } = render(
      <GivingPageContent data={createEmptyGivingData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Members does not render Development Preview", () => {
    const { container } = render(
      <MembersPageContent data={createEmptyMembersData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Banking does not render Development Preview", () => {
    const { container } = render(
      <BankingPageContent data={createEmptyBankingData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Transactions does not render Development Preview", () => {
    const { container } = render(
      <TransactionsPageContent data={createEmptyTransactionsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Bills does not render Development Preview", () => {
    const { container } = render(
      <BillsPageContent data={createEmptyBillsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Expenses does not render Development Preview", () => {
    const { container } = render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={[]}
        accountOptions={[]}
        fundOptions={[]}
      />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Vendors does not render Development Preview", () => {
    const { container } = render(
      <VendorsPageContent data={createEmptyVendorsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Funds does not render Development Preview", () => {
    const { container } = render(
      <FundsPageContent data={createEmptyFundsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Budgets does not render Development Preview", () => {
    const { container } = render(
      <BudgetsPageContent data={createEmptyBudgetsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Accounting does not render Development Preview", () => {
    const { container } = render(
      <AccountingPageContent data={createEmptyAccountingData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Reports does not render Development Preview", () => {
    const { container } = render(
      <ReportsPageContent data={createEmptyReportsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Period Close does not render Development Preview", () => {
    const { container } = render(
      <AiClosePageContent data={createEmptyAiCloseData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Compliance does not render Development Preview", () => {
    const { container } = render(
      <CompliancePageContent data={createEmptyComplianceData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Exceptions does not render Development Preview", () => {
    const { container } = render(
      <ExceptionsPageContent data={createEmptyExceptionsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Audit Vault does not render Development Preview", () => {
    const { container } = render(
      <AuditVaultPageContent data={createEmptyAuditVaultData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });

  it("Settings does not render Development Preview", () => {
    const { container } = render(
      <SettingsPageContent data={createEmptySettingsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
  });
});
