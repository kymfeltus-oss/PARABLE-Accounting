"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import {
  getExpenseDraftLinesAction,
  replaceExpenseDraftLinesAction,
} from "@/app/(workspace)/expenses/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type {
  ExpenseAccountOption,
  ExpenseFundOption,
} from "@/lib/data/expense-allocation-options";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export const ALLOCATION_SHEET_CONTENT_CLASS =
  "flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden p-0 data-[side=right]:h-dvh data-[side=right]:max-h-dvh";

export const ALLOCATION_SHEET_BODY_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden";

export const ALLOCATION_SHEET_SCROLL_BODY_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4";

export const ALLOCATION_SHEET_FOOTER_CLASS =
  "mt-0 shrink-0 border-t border-border bg-popover";

export const MAX_EXPENSE_ALLOCATION_LINES = 50;

export type ExpenseAllocationEditorExpense = {
  id: string;
  description: string;
  reference: string | null;
  totalAmount: number;
  status: string;
  lineCount: number;
};

export type ExpenseAllocationEditorProps = {
  expense: ExpenseAllocationEditorExpense;
  accountOptions: ExpenseAccountOption[];
  fundOptions: ExpenseFundOption[];
  defaultExpenseAccountId?: string | null;
};

export type EditableAllocationLine = {
  clientKey: string;
  accountId: string;
  fundId: string;
  amount: string;
  description: string;
};

let editableLineCounter = 0;

export function createBlankEditableLine(
  defaultExpenseAccountId: string | null = null,
): EditableAllocationLine {
  editableLineCounter += 1;

  return {
    clientKey: `allocation-line-${editableLineCounter}`,
    accountId: defaultExpenseAccountId ?? "",
    fundId: "",
    amount: "",
    description: "",
  };
}

export type LoadedAllocationLine = {
  id: string;
  accountId: string;
  fundId: string | null;
  description: string | null;
  amount: number;
};

export function buildEditableLinesFromDetails(
  lines: LoadedAllocationLine[],
  defaultExpenseAccountId: string | null = null,
): EditableAllocationLine[] {
  if (lines.length === 0) {
    return [createBlankEditableLine(defaultExpenseAccountId)];
  }

  return lines.map((line, index) => ({
    clientKey: `loaded-line-${line.id}-${index}`,
    accountId: line.accountId,
    fundId: line.fundId ?? "",
    amount: String(line.amount),
    description: line.description ?? "",
  }));
}

export function getAllocationTriggerLabel(lineCount: number): string {
  return lineCount === 0 ? "Allocate" : "Edit allocation";
}

export function parseAllocationAmount(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (Math.round(parsed * 100) !== parsed * 100) {
    return null;
  }

  return parsed;
}

export function normalizeAllocationDescription(
  value: string,
): string | null | "invalid" {
  const trimmed = value.trim();

  if (trimmed === "") {
    return value.length > 0 ? "invalid" : null;
  }

  return trimmed;
}

export function sumAllocationAmounts(lines: EditableAllocationLine[]): number {
  return lines.reduce((total, line) => {
    const amount = parseAllocationAmount(line.amount);
    return amount == null ? total : total + amount;
  }, 0);
}

export function normalizeLinesForSave(lines: EditableAllocationLine[]) {
  return lines.map((line) => {
    const descriptionResult = normalizeAllocationDescription(line.description);

    return {
      accountId: line.accountId.trim(),
      fundId: line.fundId.trim() === "" ? null : line.fundId.trim(),
      amount: parseAllocationAmount(line.amount) as number,
      description: descriptionResult === "invalid" ? null : descriptionResult,
    };
  });
}

export function validateEditableLinesForSave(
  lines: EditableAllocationLine[],
): string | null {
  if (lines.length < 1) {
    return "At least one allocation line is required.";
  }

  if (lines.length > MAX_EXPENSE_ALLOCATION_LINES) {
    return "Unable to update expense allocation. Please verify the information and try again.";
  }

  for (const line of lines) {
    if (line.accountId.trim() === "") {
      return "Each allocation line requires an account.";
    }

    const amount = parseAllocationAmount(line.amount);

    if (amount == null) {
      return "Each allocation line requires a valid amount.";
    }

    const descriptionResult = normalizeAllocationDescription(line.description);

    if (descriptionResult === "invalid") {
      return "Allocation line descriptions cannot be blank.";
    }
  }

  return null;
}

export function formatAllocationCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatExpenseHeading(expense: ExpenseAllocationEditorExpense): string {
  return expense.reference ?? expense.description;
}

export function ExpenseAllocationEditor({
  expense,
  accountOptions,
  fundOptions,
  defaultExpenseAccountId = null,
}: ExpenseAllocationEditorProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [linesLoaded, setLinesLoaded] = useState(false);
  const [editableLines, setEditableLines] = useState<EditableAllocationLine[]>(
    [],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allocationTotal = useMemo(
    () => sumAllocationAmounts(editableLines),
    [editableLines],
  );
  const difference = allocationTotal - expense.totalAmount;
  const triggerLabel = getAllocationTriggerLabel(expense.lineCount);
  const saveDisabled =
    isLoading ||
    !linesLoaded ||
    loadError != null ||
    isPending ||
    accountOptions.length === 0;

  const loadLines = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSuccessMessage(null);
    setLinesLoaded(false);

    const result = await getExpenseDraftLinesAction({
      expenseId: expense.id,
    });

    setIsLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      setEditableLines([]);
      setLinesLoaded(false);
      return;
    }

    setEditableLines(
      buildEditableLinesFromDetails(result.lines, defaultExpenseAccountId),
    );
    setLinesLoaded(true);
  }, [defaultExpenseAccountId, expense.id]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      void loadLines();
      return;
    }

    setLoadError(null);
    setSaveError(null);
    setSuccessMessage(null);
    setLinesLoaded(false);
    setEditableLines([]);
  }

  function updateLine(
    clientKey: string,
    patch: Partial<Omit<EditableAllocationLine, "clientKey">>,
  ) {
    setEditableLines((currentLines) =>
      currentLines.map((line) =>
        line.clientKey === clientKey ? { ...line, ...patch } : line,
      ),
    );
  }

  function addLine() {
    setEditableLines((currentLines) => {
      if (currentLines.length >= MAX_EXPENSE_ALLOCATION_LINES) {
        return currentLines;
      }

      return [...currentLines, createBlankEditableLine(defaultExpenseAccountId)];
    });
  }

  function removeLine(clientKey: string) {
    setEditableLines((currentLines) => {
      if (currentLines.length <= 1) {
        return currentLines;
      }

      return currentLines.filter((line) => line.clientKey !== clientKey);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSuccessMessage(null);

    const validationError = validateEditableLinesForSave(editableLines);

    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const normalizedLines = normalizeLinesForSave(editableLines).map((line) => ({
      accountId: line.accountId,
      fundId: line.fundId,
      amount: line.amount,
      description: line.description,
    }));

    startTransition(async () => {
      const result = await replaceExpenseDraftLinesAction({
        expenseId: expense.id,
        lines: normalizedLines,
      });

      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      setSuccessMessage(
        `Allocation saved. Authoritative total: ${formatAllocationCurrency(result.totalAmount)}.`,
      );
      setOpen(false);
    });
  }

  if (expense.status !== "draft") {
    return null;
  }

  return (
    <div className="space-y-2">
      {successMessage ? (
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          {successMessage}
        </p>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline">
            {triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent
          aria-describedby="expense-allocation-description"
          className={ALLOCATION_SHEET_CONTENT_CLASS}
        >
          <SheetHeader className="shrink-0 border-b border-border">
            <SheetTitle>Expense allocation</SheetTitle>
            <SheetDescription id="expense-allocation-description">
              Allocate {formatExpenseHeading(expense)} across expense accounts.
              Saving replaces the draft total with the allocation total.
            </SheetDescription>
          </SheetHeader>

          <div className={ALLOCATION_SHEET_BODY_CLASS}>
            {isLoading ? (
              <div
                className={ALLOCATION_SHEET_SCROLL_BODY_CLASS}
                data-allocation-sheet-scroll-body
              >
                <p
                  aria-live="polite"
                  className="text-sm text-muted-foreground"
                >
                  Loading allocation lines...
                </p>
              </div>
            ) : null}

            {loadError ? (
              <div
                className={ALLOCATION_SHEET_SCROLL_BODY_CLASS}
                data-allocation-sheet-scroll-body
              >
                <div className="space-y-3">
                  <p className="text-sm text-destructive" role="alert">
                    {loadError}
                  </p>
                  <Button onClick={() => void loadLines()} type="button">
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}

            {linesLoaded ? (
              <form
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                noValidate
                onSubmit={handleSubmit}
              >
                <div
                  className={`${ALLOCATION_SHEET_SCROLL_BODY_CLASS} space-y-4`}
                  data-allocation-sheet-scroll-body
                >
                {accountOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    No eligible active posting expense accounts are available.
                  </p>
                ) : null}

                <div
                  aria-label="Allocation totals"
                  className="rounded-md border border-border bg-muted/20 p-3 text-sm"
                >
                  <p>
                    Current draft total:{" "}
                    <span className="font-medium">
                      {formatAllocationCurrency(expense.totalAmount)}
                    </span>
                  </p>
                  <p>
                    Allocation total:{" "}
                    <span className="font-medium">
                      {formatAllocationCurrency(allocationTotal)}
                    </span>
                  </p>
                  <p>
                    Difference:{" "}
                    <span className="font-medium">
                      {formatAllocationCurrency(difference)}
                    </span>
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Saving makes the allocation total authoritative, even when it
                    differs from the current draft total.
                  </p>
                </div>

                <div className="space-y-4">
                  {editableLines.map((line, index) => (
                    <fieldset
                      key={line.clientKey}
                      className="space-y-3 rounded-md border border-border p-3"
                    >
                      <legend className="px-1 text-sm font-medium text-foreground">
                        Line {index + 1}
                      </legend>

                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor={`allocation-account-${line.clientKey}`}
                        >
                          Account
                        </label>
                        <select
                          className={inputClassName}
                          disabled={isPending}
                          id={`allocation-account-${line.clientKey}`}
                          required
                          value={line.accountId}
                          onChange={(event) =>
                            updateLine(line.clientKey, {
                              accountId: event.target.value,
                            })
                          }
                        >
                          <option value="">Select account</option>
                          {accountOptions.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor={`allocation-fund-${line.clientKey}`}
                        >
                          Fund
                        </label>
                        <select
                          className={inputClassName}
                          disabled={isPending}
                          id={`allocation-fund-${line.clientKey}`}
                          value={line.fundId}
                          onChange={(event) =>
                            updateLine(line.clientKey, {
                              fundId: event.target.value,
                            })
                          }
                        >
                          <option value="">No fund</option>
                          {fundOptions.map((fund) => (
                            <option key={fund.id} value={fund.id}>
                              {fund.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor={`allocation-amount-${line.clientKey}`}
                        >
                          Amount
                        </label>
                        <input
                          className={inputClassName}
                          disabled={isPending}
                          id={`allocation-amount-${line.clientKey}`}
                          inputMode="decimal"
                          min="0.01"
                          required
                          step="0.01"
                          type="number"
                          value={line.amount}
                          onChange={(event) =>
                            updateLine(line.clientKey, {
                              amount: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor={`allocation-description-${line.clientKey}`}
                        >
                          Description
                        </label>
                        <input
                          className={inputClassName}
                          disabled={isPending}
                          id={`allocation-description-${line.clientKey}`}
                          type="text"
                          value={line.description}
                          onChange={(event) =>
                            updateLine(line.clientKey, {
                              description: event.target.value,
                            })
                          }
                        />
                      </div>

                      <Button
                        aria-label={`Remove allocation line ${index + 1}`}
                        disabled={isPending || editableLines.length <= 1}
                        onClick={() => removeLine(line.clientKey)}
                        type="button"
                        variant="outline"
                      >
                        Remove line
                      </Button>
                    </fieldset>
                  ))}
                </div>

                <Button
                  disabled={
                    isPending ||
                    editableLines.length >= MAX_EXPENSE_ALLOCATION_LINES
                  }
                  onClick={addLine}
                  type="button"
                  variant="outline"
                >
                  Add line
                </Button>

                {saveError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {saveError}
                  </p>
                ) : null}
              </div>

              <SheetFooter className={ALLOCATION_SHEET_FOOTER_CLASS}>
                <Button className="w-full" disabled={saveDisabled} type="submit">
                  {isPending ? "Saving..." : "Save allocation"}
                </Button>
              </SheetFooter>
            </form>
          ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
