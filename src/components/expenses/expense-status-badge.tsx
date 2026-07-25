import type { ExpenseRecord } from "@/lib/data/expenses-repository";

export type ExpenseStatusPresentation =
  | "ready-to-post"
  | "posted-to-ledger"
  | "needs-allocation";

export function getExpenseStatusPresentation(
  expense: ExpenseRecord,
): ExpenseStatusPresentation {
  if (expense.status === "recorded") {
    return "posted-to-ledger";
  }

  if (expense.status === "draft" && expense.lineCount === 0) {
    return "needs-allocation";
  }

  return "ready-to-post";
}

const statusStyles: Record<
  ExpenseStatusPresentation,
  { label: string; className: string }
> = {
  "ready-to-post": {
    label: "Ready to post",
    className:
      "border-[#1677FF]/30 bg-[#1677FF]/10 text-[#1677FF]",
  },
  "posted-to-ledger": {
    label: "Posted to ledger",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  },
  "needs-allocation": {
    label: "Needs allocation",
    className:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
  },
};

type ExpenseStatusBadgeProps = {
  expense: ExpenseRecord;
};

export function ExpenseStatusBadge({ expense }: ExpenseStatusBadgeProps) {
  const presentation = getExpenseStatusPresentation(expense);
  const config = statusStyles[presentation];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
