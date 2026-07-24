"use client";

import { useState, useTransition } from "react";

import { matchBankTransactionAction } from "@/app/(workspace)/transactions/actions";
import { Button } from "@/components/ui/button";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const MATCH_TYPE_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "giving_transaction", label: "Giving transaction" },
  { value: "bill_payment", label: "Bill payment" },
  { value: "journal_entry", label: "Journal entry" },
] as const;

type MatchBankTransactionFormProps = {
  bankTransactionId: string;
  transactionLabel: string;
};

export function MatchBankTransactionForm({
  bankTransactionId,
  transactionLabel,
}: MatchBankTransactionFormProps) {
  const [matchType, setMatchType] = useState("expense");
  const [matchedSourceId, setMatchedSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set("bankTransactionId", bankTransactionId);
    formData.set("matchType", matchType);
    formData.set("matchedSourceId", matchedSourceId);

    startTransition(async () => {
      const result = await matchBankTransactionAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage("Bank transaction matched.");
      setMatchedSourceId("");
    });
  }

  return (
    <form className="mt-3 space-y-3 rounded-md border border-dashed border-border p-3" onSubmit={handleSubmit}>
      <p className="text-xs font-medium text-foreground">Match {transactionLabel}</p>

      <div>
        <label
          className="block text-xs font-medium text-muted-foreground"
          htmlFor={`match-type-${bankTransactionId}`}
        >
          Match type
        </label>
        <select
          className={inputClassName}
          disabled={isPending}
          id={`match-type-${bankTransactionId}`}
          name="matchType"
          value={matchType}
          onChange={(event) => setMatchType(event.target.value)}
        >
          {MATCH_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="block text-xs font-medium text-muted-foreground"
          htmlFor={`match-source-${bankTransactionId}`}
        >
          Source ID
        </label>
        <input
          autoComplete="off"
          className={inputClassName}
          disabled={isPending}
          id={`match-source-${bankTransactionId}`}
          name="matchedSourceId"
          placeholder="Paste expense, giving, bill payment, or journal entry ID"
          required
          type="text"
          value={matchedSourceId}
          onChange={(event) => setMatchedSourceId(event.target.value)}
        />
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p aria-live="polite" className="text-xs text-foreground" role="status">
          {successMessage}
        </p>
      ) : null}

      <Button disabled={isPending} size="sm" type="submit" variant="outline">
        {isPending ? "Matching..." : "Confirm Match"}
      </Button>
    </form>
  );
}

export { MATCH_TYPE_OPTIONS };
