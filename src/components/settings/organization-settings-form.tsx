"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

function findSuggestedAccount(
  accounts: AccountRow[],
  preferredCodes: string[],
): AccountRow | undefined {
  for (const code of preferredCodes) {
    const match = accounts.find((account) => account.code === code);
    if (match) {
      return match;
    }
  }

  return accounts[0];
}

export function OrganizationSettingsForm({
  settings,
  accounts,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const cashAccounts = useMemo(
    () => accounts.filter((account) => account.account_type === "asset"),
    [accounts],
  );

  const revenueAccounts = useMemo(
    () => accounts.filter((account) => account.account_type === "revenue"),
    [accounts],
  );

  const suggestedCash = useMemo(
    () => findSuggestedAccount(cashAccounts, ["1000"]),
    [cashAccounts],
  );

  const suggestedRevenue = useMemo(
    () => findSuggestedAccount(revenueAccounts, ["4000", "4200"]),
    [revenueAccounts],
  );

  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(
    String(settings?.fiscal_year_start_month ?? 1),
  );
  const [defaultCashAccountId, setDefaultCashAccountId] = useState(
    () => settings?.default_cash_account_id ?? suggestedCash?.id ?? "",
  );
  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState(
    () => settings?.default_revenue_account_id ?? suggestedRevenue?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasAccountOptions =
    cashAccounts.length > 0 && revenueAccounts.length > 0;
  const canSuggestDefaults = Boolean(suggestedCash || suggestedRevenue);
  const defaultsUnsaved =
    !settings?.default_cash_account_id || !settings?.default_revenue_account_id;

  function applySuggestedDefaults() {
    if (suggestedCash) {
      setDefaultCashAccountId(suggestedCash.id);
    }
    if (suggestedRevenue) {
      setDefaultRevenueAccountId(suggestedRevenue.id);
    }
    setSuccessMessage(null);
    setError(null);
  }

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
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">
        These defaults prefill giving ledger accounts and cash/bank expense
        payment accounts. Choose accounts below, then click{" "}
        <span className="font-medium text-foreground">
          Save accounting defaults
        </span>
        .
      </p>

      {defaultsUnsaved && hasAccountOptions ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm text-foreground">
            Suggested starting point:{" "}
            {suggestedCash ? formatAccountLabel(suggestedCash) : "cash account"}
            {" · "}
            {suggestedRevenue
              ? formatAccountLabel(suggestedRevenue)
              : "revenue account"}
            . Confirm the dropdowns look right, then save.
          </p>
        </div>
      ) : null}

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
          disabled={isPending || cashAccounts.length === 0}
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
        <p className="mt-1 text-xs text-muted-foreground">
          Usually your operating checking account (asset), often code 1000.
        </p>
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
          disabled={isPending || revenueAccounts.length === 0}
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
        <p className="mt-1 text-xs text-muted-foreground">
          Usually contributions or giving income (revenue), often code 4000.
        </p>
      </div>

      {!hasAccountOptions ? (
        <p className="text-sm text-muted-foreground" role="status">
          No active posting accounts were found. Open Accounting and make sure
          your chart of accounts has active asset and revenue accounts, then
          return here.
        </p>
      ) : null}

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

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={isPending || !hasAccountOptions} type="submit">
          {isPending ? "Saving..." : "Save accounting defaults"}
        </Button>
        {canSuggestDefaults ? (
          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={applySuggestedDefaults}
          >
            Use suggested defaults
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export type { OrganizationSettingsFormProps };
