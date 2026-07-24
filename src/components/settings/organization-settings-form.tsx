"use client";

import { useMemo, useState, useTransition } from "react";

import { updateOrganizationSettingsAction } from "@/app/(workspace)/settings/actions";
import { Button } from "@/components/ui/button";
import type {
  AccountRow,
  OrganizationSettingsRow,
} from "@/lib/data/types/rows";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const FISCAL_MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

type OrganizationSettingsFormProps = {
  settings: OrganizationSettingsRow | null;
  accounts: AccountRow[];
};

function formatAccountLabel(account: AccountRow): string {
  return `${account.code} — ${account.name}`;
}

export function OrganizationSettingsForm({
  settings,
  accounts,
}: OrganizationSettingsFormProps) {
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(
    String(settings?.fiscal_year_start_month ?? 1),
  );
  const [defaultCashAccountId, setDefaultCashAccountId] = useState(
    settings?.default_cash_account_id ?? "",
  );
  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState(
    settings?.default_revenue_account_id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cashAccounts = useMemo(
    () => accounts.filter((account) => account.account_type === "asset"),
    [accounts],
  );

  const revenueAccounts = useMemo(
    () => accounts.filter((account) => account.account_type === "revenue"),
    [accounts],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set("fiscalYearStartMonth", fiscalYearStartMonth);
    formData.set("defaultCashAccountId", defaultCashAccountId);
    formData.set("defaultRevenueAccountId", defaultRevenueAccountId);

    startTransition(async () => {
      const result = await updateOrganizationSettingsAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage("Accounting defaults updated.");
    });
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <div>
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="fiscal-year-start-month"
        >
          Fiscal year start month
        </label>
        <select
          className={inputClassName}
          disabled={isPending}
          id="fiscal-year-start-month"
          name="fiscalYearStartMonth"
          value={fiscalYearStartMonth}
          onChange={(event) => setFiscalYearStartMonth(event.target.value)}
        >
          {FISCAL_MONTHS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="default-cash-account-id"
        >
          Default cash account
        </label>
        <select
          className={inputClassName}
          disabled={isPending}
          id="default-cash-account-id"
          name="defaultCashAccountId"
          value={defaultCashAccountId}
          onChange={(event) => setDefaultCashAccountId(event.target.value)}
        >
          <option value="">No default selected</option>
          {cashAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {formatAccountLabel(account)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="default-revenue-account-id"
        >
          Default revenue account
        </label>
        <select
          className={inputClassName}
          disabled={isPending}
          id="default-revenue-account-id"
          name="defaultRevenueAccountId"
          value={defaultRevenueAccountId}
          onChange={(event) => setDefaultRevenueAccountId(event.target.value)}
        >
          <option value="">No default selected</option>
          {revenueAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {formatAccountLabel(account)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          {successMessage}
        </p>
      ) : null}

      <Button disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save accounting defaults"}
      </Button>
    </form>
  );
}

export type { OrganizationSettingsFormProps };
