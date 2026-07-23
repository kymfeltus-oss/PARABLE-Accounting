import type { AccountRow } from "./types/rows";
import type { FundRecord } from "./funds-repository";

export type ExpenseAccountOption = {
  id: string;
  code: string;
  name: string;
  label: string;
};

export type ExpenseFundOption = {
  id: string;
  code: string | null;
  name: string;
  label: string;
};

function formatAccountLabel(code: string, name: string): string {
  return `${code} · ${name}`;
}

function formatFundLabel(code: string | null, name: string): string {
  if (code == null || code.trim() === "") {
    return name;
  }

  return `${code} · ${name}`;
}

export function mapExpenseAccountOptions(
  accounts: AccountRow[],
): ExpenseAccountOption[] {
  return accounts
    .filter(
      (account) =>
        account.account_type === "expense" &&
        account.status === "active" &&
        account.is_posting,
    )
    .map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      label: formatAccountLabel(account.code, account.name),
    }));
}

export function mapExpenseFundOptions(funds: FundRecord[]): ExpenseFundOption[] {
  return funds
    .filter((fund) => fund.status === "active")
    .map((fund) => ({
      id: fund.id,
      code: fund.code,
      name: fund.name,
      label: formatFundLabel(fund.code, fund.name),
    }));
}
