import type { AccountingData } from "@/lib/data/accounting-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

import { createEmptyFinancialReports } from "./financial-reports-fixtures";

const emptyTrialBalance = createEmptyFinancialReports().trialBalance;

export function createEmptyAccountingData(
  organizationId: string = TEST_ORGANIZATION_ID,
): AccountingData {
  return {
    organizationId,
    accounts: [],
    periods: [],
    journalEntries: [],
    trialBalance: emptyTrialBalance,
    asOfDate: "2026-07-24",
    counts: {
      totalAccounts: 0,
      activeAccounts: 0,
      openPeriods: 0,
      closedPeriods: 0,
      postedJournalEntries: 0,
      draftJournalEntries: 0,
    },
  };
}

export function createPopulatedAccountingData(): AccountingData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    accounts: [
      {
        id: "account-1",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "1000",
        name: "Operating Cash",
        account_type: "asset",
        is_posting: true,
        status: "active",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
        balance: 150,
      },
      {
        id: "account-2",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: "account-1",
        code: "5100",
        name: "Office Expense",
        account_type: "expense",
        is_posting: true,
        status: "inactive",
        created_at: "2026-01-02T12:00:00.000Z",
        updated_at: "2026-01-02T12:00:00.000Z",
        balance: 0,
      },
    ],
    periods: [
      {
        id: "period-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "July 2026",
        start_date: "2026-07-01",
        end_date: "2026-07-31",
        status: "open",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
        isCurrent: true,
      },
      {
        id: "period-2",
        organization_id: TEST_ORGANIZATION_ID,
        name: "June 2026",
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        status: "closed",
        created_at: "2026-06-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
        isCurrent: false,
      },
    ],
    journalEntries: [
      {
        id: "journal-1",
        organization_id: TEST_ORGANIZATION_ID,
        accounting_period_id: "period-1",
        entry_number: "JE-1001",
        entry_date: "2026-07-10",
        description: "Office supplies purchase",
        source_type: "manual",
        status: "posted",
        created_at: "2026-07-10T12:00:00.000Z",
        updated_at: "2026-07-10T12:00:00.000Z",
        lineCount: 2,
        debitTotal: 150,
        creditTotal: 150,
        isBalanced: true,
      },
      {
        id: "journal-2",
        organization_id: TEST_ORGANIZATION_ID,
        accounting_period_id: "period-1",
        entry_number: "JE-1002",
        entry_date: "2026-07-12",
        description: "Draft utility accrual",
        source_type: "manual",
        status: "draft",
        created_at: "2026-07-12T12:00:00.000Z",
        updated_at: "2026-07-12T12:00:00.000Z",
        lineCount: 2,
        debitTotal: 200,
        creditTotal: 100,
        isBalanced: false,
      },
    ],
    trialBalance: {
      asOfDate: "2026-07-24",
      rows: [
        {
          id: "account-1",
          code: "1000",
          name: "Operating Cash",
          accountType: "asset",
          debitBalance: 150,
          creditBalance: 0,
        },
      ],
      totalDebits: 150,
      totalCredits: 150,
      isBalanced: true,
    },
    asOfDate: "2026-07-24",
    counts: {
      totalAccounts: 2,
      activeAccounts: 1,
      openPeriods: 1,
      closedPeriods: 1,
      postedJournalEntries: 1,
      draftJournalEntries: 1,
    },
  };
}
